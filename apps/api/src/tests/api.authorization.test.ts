import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../http/app.js";
import { InMemoryApplicationRepository } from "./in-memory-repository.js";

describe("application workflow API authorization", () => {
  it("returns 403 when an applicant calls the reviewer approval endpoint", async () => {
    const repo = new InMemoryApplicationRepository();
    const app = createApp({
      repo,
      jwtSecret: "test-secret",
      webOrigin: "http://localhost:5173"
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "password123" })
      .expect(200);

    const token = login.body.token as string;

    const response = await request(app)
      .post("/api/applications/submitted-1/transitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "APPROVE" })
      .expect(403);

    expect(response.body.error).toMatchObject({
      code: "REVIEWER_REQUIRED"
    });
  });

  it("lets a reviewer approve and records the transition in the audit log", async () => {
    const repo = new InMemoryApplicationRepository();
    const app = createApp({
      repo,
      jwtSecret: "test-secret",
      webOrigin: "http://localhost:5173"
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "reviewer@example.com", password: "password123" })
      .expect(200);

    const token = login.body.token as string;

    const response = await request(app)
      .post("/api/applications/submitted-1/transitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "APPROVE" })
      .expect(200);

    expect(response.body.application).toMatchObject({
      id: "submitted-1",
      status: "APPROVED"
    });
    expect(response.body.application.auditLog).toEqual([
      expect.objectContaining({
        actorName: "Chanda Mwila",
        oldStatus: "SUBMITTED",
        newStatus: "APPROVED"
      })
    ]);
  });

  it("supports a returned-for-changes revision round trip", async () => {
    const repo = new InMemoryApplicationRepository();
    const app = createApp({
      repo,
      jwtSecret: "test-secret",
      webOrigin: "http://localhost:5173"
    });

    const reviewerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "reviewer@example.com", password: "password123" })
      .expect(200);
    const reviewerToken = reviewerLogin.body.token as string;

    const returned = await request(app)
      .post("/api/applications/submitted-1/transitions")
      .set("Authorization", `Bearer ${reviewerToken}`)
      .send({
        action: "RETURN_CHANGES",
        comment: "Please add the affected road section and estimated start date."
      })
      .expect(200);

    expect(returned.body.application).toMatchObject({
      id: "submitted-1",
      status: "RETURNED"
    });
    expect(returned.body.application.auditLog).toEqual([
      expect.objectContaining({
        actorName: "Chanda Mwila",
        oldStatus: "SUBMITTED",
        newStatus: "RETURNED",
        comment: "Please add the affected road section and estimated start date."
      })
    ]);

    const applicantLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "password123" })
      .expect(200);
    const applicantToken = applicantLogin.body.token as string;

    await request(app)
      .patch("/api/applications/submitted-1")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({
        title: "Drainage repair near Kamwala clinic",
        category: "PUBLIC_WORKS",
        description:
          "Storm water is collecting near the clinic entrance after heavy rain. The blocked section is along the east access road and work can start in July.",
        amountCents: 525000
      })
      .expect(200);

    const resubmitted = await request(app)
      .post("/api/applications/submitted-1/submit")
      .set("Authorization", `Bearer ${applicantToken}`)
      .expect(200);

    expect(resubmitted.body.application).toMatchObject({
      id: "submitted-1",
      status: "SUBMITTED"
    });
    expect(resubmitted.body.application.revisions).toEqual([
      expect.objectContaining({
        revisionNumber: 2,
        amountCents: 525000,
        description:
          "Storm water is collecting near the clinic entrance after heavy rain. The blocked section is along the east access road and work can start in July."
      }),
      expect.objectContaining({
        revisionNumber: 1,
        amountCents: 450000
      })
    ]);
    expect(resubmitted.body.application.auditLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          oldStatus: "RETURNED",
          newStatus: "SUBMITTED"
        })
      ])
    );
  });
});
