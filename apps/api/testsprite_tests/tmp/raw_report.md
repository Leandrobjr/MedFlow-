# TestSprite - Relatório de Execução Local

## Resultados

### TC001_verify_tenant_isolation_on_all_endpoints
- **Status:** FAILED
- **Erro:**
```
on_all_endpoints()
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
  File "D:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api\testsprite_tests\TC001_verify_tenant_isolation_on_all_endpoints.py", line 206, in test_verify_tenant_isolation_on_all_endpoints
    assert resp.status_code in (400, 401, 403), "Expected error on missing tenant context header /patients/:id"
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Expected error on missing tenant context header /patients/:id
```

### TC002_test_jwt_cookie_authentication_flow
- **Status:** PASSED

### TC003_test_appointments_scheduling_and_status_updates
- **Status:** PASSED

### TC004_test_patients_crud_operations
- **Status:** PASSED

### TC005_test_staff_and_procedures_management
- **Status:** PASSED

### TC006_test_pep_medical_records_management
- **Status:** FAILED
- **Erro:**
```
<module>
    test_pep_medical_records_management()
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
  File "D:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api\testsprite_tests\TC006_test_pep_medical_records_management.py", line 136, in test_pep_medical_records_management
    assert addendum_resp.status_code == 201, f"Failed to add addendum: {addendum_resp.text}"
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Failed to add addendum: {"statusCode":500,"message":"Internal server error"}
```

### TC007_test_finance_transactions_and_closures
- **Status:** FAILED
- **Erro:**
```
nd_closures()
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^
  File "D:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api\testsprite_tests\TC007_test_finance_transactions_and_closures.py", line 144, in test_finance_transactions_and_closures
    assert box_close_resp.status_code == 201, f"Box close failed: {box_close_resp.text}"
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Box close failed: {"message":"Seu caixa deste dia já está fechado.","error":"Bad Request","statusCode":400}
```

### TC008_test_pdf_report_generation_and_access_control
- **Status:** FAILED
- **Erro:**
```
t_pdf_report_generation_and_access_control
    closure = close_receptionist_box(session_admin, TENANT_SLUG, today, 1000.0, 1500.0)
  File "D:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo\apps\api\testsprite_tests\TC008_test_pdf_report_generation_and_access_control.py", line 95, in close_receptionist_box
    raise AssertionError("Caixa já fechado hoje. Execute o teste uma vez por dia ou reinicie o banco.")
AssertionError: Caixa já fechado hoje. Execute o teste uma vez por dia ou reinicie o banco.
```

### TC009_test_schedule_configuration_and_blocks_management
- **Status:** PASSED

### TC010_test_suppliers_and_expense_categories_crud
- **Status:** PASSED

