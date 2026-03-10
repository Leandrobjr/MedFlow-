"""Runner para executar todos os testes TestSprite e gerar relatório."""
import subprocess
import sys
from pathlib import Path

TESTS = [
    "TC001_verify_tenant_isolation_on_all_endpoints",
    "TC002_test_jwt_cookie_authentication_flow",
    "TC003_test_appointments_scheduling_and_status_updates",
    "TC004_test_patients_crud_operations",
    "TC005_test_staff_and_procedures_management",
    "TC006_test_pep_medical_records_management",
    "TC007_test_finance_transactions_and_closures",
    "TC008_test_pdf_report_generation_and_access_control",
    "TC009_test_schedule_configuration_and_blocks_management",
    "TC010_test_suppliers_and_expense_categories_crud",
]

def main():
    base = Path(__file__).parent
    results = []
    for name in TESTS:
        path = base / f"{name}.py"
        if not path.exists():
            results.append((name, "SKIP", "Arquivo não encontrado"))
            continue
        r = subprocess.run(
            [sys.executable, str(path)],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(base.parent),
        )
        if r.returncode == 0:
            results.append((name, "PASSED", ""))
        else:
            err = (r.stderr or r.stdout or "")[-500:]
            results.append((name, "FAILED", err.strip()))
    # Print summary
    passed = sum(1 for _, s, _ in results if s == "PASSED")
    failed = sum(1 for _, s, _ in results if s == "FAILED")
    print("\n" + "=" * 60)
    print("RESUMO DOS TESTES")
    print("=" * 60)
    for name, status, err in results:
        print(f"  {name}: {status}")
        if err:
            for line in err.split("\n")[-5:]:
                print(f"    {line}")
    print("=" * 60)
    print(f"Total: {len(results)} | Passaram: {passed} | Falharam: {failed}")
    print("=" * 60)
    # Write raw report for TestSprite format
    raw = base / "tmp" / "raw_report.md"
    raw.parent.mkdir(exist_ok=True)
    with open(raw, "w", encoding="utf-8") as f:
        f.write("# TestSprite - Relatório de Execução Local\n\n")
        f.write("## Resultados\n\n")
        for name, status, err in results:
            f.write(f"### {name}\n- **Status:** {status}\n")
            if err:
                f.write(f"- **Erro:**\n```\n{err}\n```\n")
            f.write("\n")
    print(f"\nRelatório salvo em: {raw}")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
