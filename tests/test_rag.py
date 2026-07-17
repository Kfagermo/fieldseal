import unittest
import os
import json
import tempfile
from pathlib import Path

# Setup test environment variables before importing app
import tempfile
import shutil

# Create a temp dir for database
temp_dir = tempfile.mkdtemp(prefix="esense-test-")
db_path = Path(temp_dir) / "esense.db"
os.environ["ESENSE_DB_PATH"] = str(db_path)
os.environ["ESENSE_EVIDENCE_PATH"] = str(Path(temp_dir) / "evidence_test")
os.environ["SECRET_KEY"] = "test-secret"
os.environ["ESENSE_MIDNIGHT_ENABLED"] = "false"

from retriever import Retriever
from compliance_agent import ComplianceAgent
import app as esense

class TestRAGPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Build policy store for testing
        cls.retriever = Retriever()
        cls.agent = ComplianceAgent(cls.retriever)
        esense.init_db()


        # Add a dummy user and assignment in SQLite for testing the API
        with esense.db() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO users (id, google_sub, email, display_name, created_at, updated_at)
                VALUES ('usr_test', 'sub_test', 'test@example.com', 'Tester', '2026-07-17', '2026-07-17')
                """
            )
            connection.execute(
                """
                INSERT OR IGNORE INTO organizations (id, name, organization_type, created_by, created_at, updated_at)
                VALUES ('org_test', 'Test Org', 'school', 'usr_test', '2026-07-17', '2026-07-17')
                """
            )
            connection.execute(
                """
                INSERT OR IGNORE INTO assignments (
                    id, organization_id, title, purpose, desired_result, known_scope,
                    known_constraints, location_context, execution_context, due_at,
                    expected_submission, work_families_json, provider_id, professional_responsible,
                    version, status, created_at, updated_at
                ) VALUES (
                    'asg_test', 'org_test', 'Test Job', 'Purpose', 'Result', 'Install EV charger',
                    'None', 'Location', 'Execution', '2026-07-20', 'Submission', '["electro"]',
                    'usr_test', 'Supervisor', 1, 'accepted_plan', '2026-07-17', '2026-07-17'
                )
                """
            )

    def test_document_processing_no_empty_chunks(self):
        # Ingestion test
        self.assertTrue(len(self.retriever.chunks) > 0, "No chunks ingested")
        for chunk in self.retriever.chunks:
            self.assertIsNotNone(chunk.get("id"))
            self.assertIsNotNone(chunk.get("title"))
            self.assertTrue(len(chunk.get("tokens", [])) > 0, "Empty tokens in chunk")

    def test_retrieval_quality(self):
        # Semantic search relevance tests
        results = self.retriever.search("install residential EV charger")
        ids = [c["id"] for c in results]
        self.assertTrue(any(i in ids for i in ["electrical_planning_risk", "five_safe"]), "EV charger did not retrieve FEL/5-sikre")

    def test_compliance_analysis_ev_charger(self):
        # Test 1: Install residential EV charger
        # Expected: NEC 625/FEL retrieved, Permit mentioned, Inspection mentioned
        res = self.agent.analyze("Install residential EV charger")
        self.assertTrue(res["success"])
        codes = [r["code"] for r in res["applicable_regulations"]]
        self.assertIn("NEC 625", codes)
        
        required_text = "".join(res["required"])
        self.assertIn("Permit", required_text)
        self.assertIn("Inspection", required_text)
        
        missing_text = "".join(res["missing"])
        self.assertIn("Torque measurement", missing_text)
        self.assertIn("Panel photo", missing_text)

    def test_compliance_analysis_breaker_panel(self):
        # Test 2: Replace breaker panel
        res = self.agent.analyze("Replace breaker panel")
        self.assertTrue(res["success"])
        codes = [r["code"] for r in res["applicable_regulations"]]
        self.assertTrue(any("FEL" in c for c in codes))

    def test_compliance_analysis_commercial_lighting(self):
        # Test 3: Commercial lighting installation
        res = self.agent.analyze("Commercial lighting installation")
        self.assertTrue(res["success"])
        codes = [r["code"] for r in res["applicable_regulations"]]
        self.assertTrue(any("FEL" in c or "FEK" in c for c in codes))

    def test_compliance_analysis_teleporter(self):
        # Test 4: Unknown query -> Install teleporter
        res = self.agent.analyze("Install teleporter")
        self.assertTrue(res["success"])
        self.assertEqual(res["applicable_regulations"], [])
        self.assertEqual(res["required"], [])
        self.assertEqual(res["missing"], [])

    def test_compliance_analysis_missing_job_desc(self):
        # Test 5: Missing job description
        res = self.agent.analyze("")
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "VALIDATION_ERROR")

    def test_api_integration_endpoint(self):
        # E2E-like API test
        client = esense.app.test_client()
        with client.session_transaction() as sess:
            sess["user_id"] = "usr_test"
            sess["csrf"] = "test-csrf-token"
        
        response = client.post(
            "/api/assignments/asg_test/analyze",
            data=json.dumps({"job_description": "Install residential EV charger"}),
            headers={"X-CSRF-Token": "test-csrf-token"},
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data["success"])
        self.assertTrue(any(r["code"] == "NEC 625" for r in data["applicable_regulations"]))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    unittest.main()


