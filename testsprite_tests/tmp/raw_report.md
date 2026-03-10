
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** repo
- **Date:** 2026-03-04
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Create an appointment from Agenda day view and see it on the calendar
- **Test Code:** [TC001_Create_an_appointment_from_Agenda_day_view_and_see_it_on_the_calendar.py](./TC001_Create_an_appointment_from_Agenda_day_view_and_see_it_on_the_calendar.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login did not redirect to /dashboard after valid credentials were submitted (two attempts: Enter key and submit button click).
- The application remained on the /login page with no dashboard elements visible; current URL is http://localhost:3000/login.
- No error message or client-side validation was displayed to explain the failed login attempt.
- Dashboard and agenda features could not be reached, preventing verification of appointment creation (dependency: successful authentication).
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/1ebfc728-9b3d-42fa-bce5-fa0444b1bc3e
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Prevent creating an appointment when selected time is blocked as Ocupado (external calendar conflict)
- **Test Code:** [TC002_Prevent_creating_an_appointment_when_selected_time_is_blocked_as_Ocupado_external_calendar_conflict.py](./TC002_Prevent_creating_an_appointment_when_selected_time_is_blocked_as_Ocupado_external_calendar_conflict.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login submit button not found on page interactive elements
- Valid credentials were entered but submitting the form did not navigate to the dashboard; URL remains /login
- Keyboard submit attempts (Enter) were performed twice and did not trigger authentication or an error message
- Cannot proceed to the Agenda or appointment conflict verification because the authentication step is blocked
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/49e986d3-558f-4ca8-818f-fff8937bb758
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Save weekly schedule configuration for a selected professional
- **Test Code:** [TC005_Save_weekly_schedule_configuration_for_a_selected_professional.py](./TC005_Save_weekly_schedule_configuration_for_a_selected_professional.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login did not redirect to the dashboard after two submission attempts (Enter pressed twice) on the login page.
- The visible 'Entrar no sistema' control is not exposed as an interactive element index, preventing a click-based login action.
- No alternate navigation or clickable element exists on the page to reach the dashboard or Agenda without successful authentication.
- No error message or UI feedback was observed to explain the failed authentication or next steps.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/5c7153b6-a2ba-4b6f-b384-16646638dbf5
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Add a new schedule block (vacation/holiday/period) and confirm it appears in the list
- **Test Code:** [TC007_Add_a_new_schedule_block_vacationholidayperiod_and_confirm_it_appears_in_the_list.py](./TC007_Add_a_new_schedule_block_vacationholidayperiod_and_confirm_it_appears_in_the_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Submit button not found on page: the visible 'Entrar no sistema' control is not present in the page's interactive elements list and cannot be clicked.
- Login failed - URL does not contain '/dashboard' after submitting credentials by pressing Enter twice.
- Clicked element index 137 corresponds to 'Fale com um consultor' instead of the login submit control.
- Authentication flow cannot proceed because there is no accessible submit control or alternative interaction to complete login.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/18e1d525-831b-4580-8e2b-dad70803dfcf
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Prevent saving a block when end date is before start date
- **Test Code:** [TC008_Prevent_saving_a_block_when_end_date_is_before_start_date.py](./TC008_Prevent_saving_a_block_when_end_date_is_before_start_date.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - after submitting valid credentials the application remained on the /login page and the login form stayed visible.
- Submit button not found or not interactable - the visible 'Entrar no sistema' control had no interactive element index available for a reliable click.
- Dashboard not reachable - URL did not contain '/dashboard' after multiple submit attempts, preventing access to Agenda/Configuração to perform the block date validation test.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/ac01156d-74da-4443-9e32-62cd42a1d175
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Create a new patient successfully (with CPF and contact)
- **Test Code:** [TC009_Create_a_new_patient_successfully_with_CPF_and_contact.py](./TC009_Create_a_new_patient_successfully_with_CPF_and_contact.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login submit button not found as an interactive element on the login page.
- Login could not be submitted: pressing Enter did not authenticate or navigate to /dashboard.
- Patient creation could not be tested because the authentication step could not be completed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/3419d5d0-44e8-4ffa-98b8-002b8236c7a4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Create a new staff member with role and procedure linkage
- **Test Code:** [TC011_Create_a_new_staff_member_with_role_and_procedure_linkage.py](./TC011_Create_a_new_staff_member_with_role_and_procedure_linkage.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login button not found on page (no interactive element available to trigger submission).
- Login did not succeed - application did not navigate to /dashboard after multiple submit attempts (SVG click and Enter presses).
- Form submission via keyboard (Enter) and SVG click produced no effect; necessary interactive control to perform login is not exposed in the page's accessible elements.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/627fa88b-89db-47ed-a892-105e5cc5077d
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Create a new procedure successfully (name and pricing)
- **Test Code:** [TC013_Create_a_new_procedure_successfully_name_and_pricing.py](./TC013_Create_a_new_procedure_successfully_name_and_pricing.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login did not redirect to /dashboard after submitting credentials on the login page (current URL remains '/login').
- The visible 'Entrar no sistema' login control is not present in the page's interactive elements list and cannot be clicked programmatically.
- Keyboard-based submission attempts (Enter, Tab+Enter) did not trigger authentication or navigation to the dashboard.
- Repeated submission attempts and an accidental click on a different button ('Fale com um consultor') exhausted available retries without reaching the dashboard.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/b41d22e9-eaf2-41c1-bc9c-4ce79b1760fe
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Create a new supplier successfully
- **Test Code:** [TC015_Create_a_new_supplier_successfully.py](./TC015_Create_a_new_supplier_successfully.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login submit button 'Entrar no sistema' not present as an interactive element on the login page (cannot click it programmatically).
- Form submission via Enter key did not navigate to the dashboard; current URL remains '/login' after two attempts.
- Authentication could not be completed, preventing navigation to the Suppliers page and creation/verification of a supplier.
- Critical interactive control appears to be inside a shadow DOM or otherwise not exposed to the agent, blocking automated test execution.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/fb45c8d7-8aac-4b86-a4f6-d1da0e9cbec1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Finalize a new SOAP record linked to an appointment
- **Test Code:** [TC017_Finalize_a_new_SOAP_record_linked_to_an_appointment.py](./TC017_Finalize_a_new_SOAP_record_linked_to_an_appointment.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Submit button 'Entrar no sistema' not found as an interactive element on the login page.
- Login submission via Enter (2 attempts) did not redirect to /dashboard.
- Clicking other visible buttons (index 136 'Fale com um consultor') does not submit the login form.
- No alternative interactive control or navigation on the page allows completing authentication.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/bbff7035-5e83-4b8f-9ee8-b0b0fc7d750e
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018 Complete SOAP fields and finalize record (continuation from created record screen)
- **Test Code:** [TC018_Complete_SOAP_fields_and_finalize_record_continuation_from_created_record_screen.py](./TC018_Complete_SOAP_fields_and_finalize_record_continuation_from_created_record_screen.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login to the application failed: dashboard page not reached after multiple submit attempts.
- The visible 'Entrar no sistema' login button is not available as an interactive element; clicks on index 135 targeted a different button ('Fale com um consultor').
- Submitting the form via Enter key while focusing inputs did not trigger navigation to /dashboard.
- The page remains on the login screen (/login) with credentials populated but no dashboard content loaded.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/7fde04b7-023e-487c-a226-4b57fd482ba8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Validate required SOAP fields before finalization
- **Test Code:** [TC020_Validate_required_SOAP_fields_before_finalization.py](./TC020_Validate_required_SOAP_fields_before_finalization.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login button 'Entrar no sistema' not found as an interactive element on the login page, preventing programmatic submission.
- Form submission via Enter did not authenticate the session despite 4 attempts and both email and password fields being populated.
- Clicking a clickable element (index 135) activated 'Fale com um consultor' instead of submitting the login form.
- Unable to access protected sections (e.g., PEP) because authentication cannot be completed, blocking the remainder of the test.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/330b8138-f8b7-47cc-8f35-33fed3009a26
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC022 Create an income transaction and verify it appears in the transactions list
- **Test Code:** [TC022_Create_an_income_transaction_and_verify_it_appears_in_the_transactions_list.py](./TC022_Create_an_income_transaction_and_verify_it_appears_in_the_transactions_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login submit button 'Entrar no sistema' not available as an interactive element on the /login page.
- Attempts to submit the login form by sending Enter (two attempts) did not navigate to /dashboard.
- Clickable interactive element present ([138]) corresponds to 'Fale com um consultor' and is not the login submit control, preventing programmatic submission of the form.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/a152de61-fe52-44a4-af85-2161f0c0eef9
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 Create an expense transaction and verify it appears in the transactions list
- **Test Code:** [TC023_Create_an_expense_transaction_and_verify_it_appears_in_the_transactions_list.py](./TC023_Create_an_expense_transaction_and_verify_it_appears_in_the_transactions_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Entrar no sistema (Login) button not found on page
- Dashboard page not reached after submitting credentials (URL does not contain '/dashboard')
- Login submission did not trigger navigation; login form inputs are still visible after repeated submission attempts
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/210863eb-a087-4a30-9eba-3ab7c73855a5
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC024 Validate required fields when saving a transaction with empty form
- **Test Code:** [TC024_Validate_required_fields_when_saving_a_transaction_with_empty_form.py](./TC024_Validate_required_fields_when_saving_a_transaction_with_empty_form.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login button ('Entrar no sistema') not available as an interactive element on the login page, preventing automated click and form submission.
- Enter key submissions did not trigger a successful login; the URL remains '/login' after multiple Enter submissions.
- Clickable interactive element index 135 corresponds to 'Fale com um consultor' and was clicked instead of a login action, indicating the expected login control is not exposed for automation.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/2f2d52b6-e984-432a-97d3-aeb301470277/c762cf97-d419-4de8-b0f9-65bf4e290a48
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **0.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---