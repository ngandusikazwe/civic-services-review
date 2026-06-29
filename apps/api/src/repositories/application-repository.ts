import type {
  ApplicationPayload,
  ApplicationRecord,
  ApplicationWithAudit,
  TransitionParams,
  User
} from "../types.js";
import type { ApplicationStatus } from "@workflow/workflow";

export interface ApplicationRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  listApplications(params: {
    user: User;
    status?: ApplicationStatus;
  }): Promise<ApplicationRecord[]>;
  getApplication(id: string): Promise<ApplicationWithAudit | null>;
  createApplication(params: {
    ownerId: string;
    payload: ApplicationPayload;
  }): Promise<ApplicationRecord>;
  updateDraft(params: {
    applicationId: string;
    payload: ApplicationPayload;
  }): Promise<ApplicationRecord>;
  transition(params: TransitionParams): Promise<ApplicationWithAudit>;
}
