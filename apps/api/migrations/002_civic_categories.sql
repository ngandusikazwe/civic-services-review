alter table applications
  drop constraint if exists applications_category_check;

update applications
set category = case category
  when 'EQUIPMENT' then 'PUBLIC_WORKS'
  when 'TRAVEL' then 'COMMUNITY_GRANT'
  when 'SOFTWARE' then 'BUSINESS_PERMIT'
  when 'OTHER' then 'GENERAL_SERVICE'
  else category
end;

alter table applications
  add constraint applications_category_check
  check (category in (
    'BUSINESS_PERMIT',
    'BUILDING_PERMIT',
    'COMMUNITY_GRANT',
    'PUBLIC_WORKS',
    'GENERAL_SERVICE'
  ));
