# Self-hosted, one deployment per user

dynacal is deployed by each user for themselves, so there is no central database holding everyone's Tasks and calendar data. We chose this over a hosted multi-tenant service to keep personal schedules and calendar credentials under the user's own control. It means every deployment brings its own calendar API credentials and infrastructure, and features that assume a central service (shared accounts, cross-user data) are out of scope.
