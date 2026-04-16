#!/usr/bin/env python3
"""
AI Interview Assistant Backend API Testing
Tests all authentication, session management, and interview flows
"""

import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional

class AIInterviewTester:
    def __init__(self, base_url: str = "https://interview-queue-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.recruiter_token = None
        self.session_id = None
        self.access_token = None
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None, 
                 cookies: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
            
        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, cookies=cookies)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "ERROR")
                if response.text:
                    self.log(f"Response: {response.text[:200]}", "ERROR")

            try:
                response_data = response.json() if response.text else {}
            except json.JSONDecodeError:
                response_data = {"raw_response": response.text}
                
            return success, response_data

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {"error": str(e)}

    def test_health_check(self) -> bool:
        """Test basic API health"""
        success, _ = self.run_test("Health Check", "GET", "", 200)
        return success

    def test_invalid_login(self) -> bool:
        """Test login with invalid credentials"""
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login", 
            401,
            data={"email": "wrong@email.com", "password": "wrongpass"}
        )
        return success

    def test_register_recruiter(self) -> bool:
        """Test recruiter registration"""
        timestamp = int(time.time())
        email = f"recruiter{timestamp}@test.com"
        
        success, response = self.run_test(
            "Recruiter Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": email,
                "password": "TestPass123!",
                "name": f"Test Recruiter {timestamp}"
            }
        )
        
        if success and 'id' in response:
            self.log(f"Recruiter registered: {response.get('email')}")
            return True
        return False

    def test_get_current_user(self) -> bool:
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'email' in response:
            self.log(f"Current user: {response.get('email')} ({response.get('role')})")
            return True
        return False

    def test_dashboard_stats(self) -> bool:
        """Test dashboard statistics endpoint (Updated for v2.0 with authenticity metrics)"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "stats",
            200
        )
        
        if success:
            stats = response
            self.log(f"Stats - Total: {stats.get('total_sessions', 0)}, "
                    f"Completed: {stats.get('completed', 0)}, "
                    f"Pending: {stats.get('pending', 0)}")
            
            # Check for new v2.0 authenticity metrics
            if 'average_authenticity' in stats:
                self.log(f"✅ Authenticity metrics found - Avg: {stats['average_authenticity']}")
            
            if 'understanding_breakdown' in stats:
                breakdown = stats['understanding_breakdown']
                self.log(f"✅ Understanding breakdown - Independent: {breakdown.get('independent', 0)}, "
                        f"Guided: {breakdown.get('guided', 0)}, "
                        f"AI Dependent: {breakdown.get('ai_dependent', 0)}")
            
            return True
        return False

    def test_create_interview_session(self) -> bool:
        """Test creating an interview session"""
        timestamp = int(time.time())
        session_data = {
            "title": f"Test Interview {timestamp}",
            "job_role": "Software Engineer",
            "topics": ["Python", "JavaScript", "System Design"],
            "difficulty": "medium",
            "question_count": 2,
            "time_limit": 30,
            "candidate_email": f"candidate{timestamp}@test.com",
            "candidate_name": f"Test Candidate {timestamp}"
        }
        
        success, response = self.run_test(
            "Create Interview Session",
            "POST",
            "sessions/create",
            200,
            data=session_data
        )
        
        if success and 'id' in response:
            self.session_id = response['id']
            self.access_token = response['access_token']
            self.log(f"Session created: {response['title']} (ID: {self.session_id})")
            self.log(f"Access token: {self.access_token}")
            return True
        return False

    def test_list_sessions(self) -> bool:
        """Test listing interview sessions"""
        success, response = self.run_test(
            "List Sessions",
            "GET",
            "sessions/list",
            200
        )
        
        if success and isinstance(response, list):
            self.log(f"Found {len(response)} sessions")
            return True
        return False

    def test_get_session_details(self) -> bool:
        """Test getting session details (Updated for v2.0 with authenticity analysis)"""
        if not self.session_id:
            self.log("No session ID available for testing", "WARNING")
            return False
            
        success, response = self.run_test(
            "Get Session Details",
            "GET",
            f"sessions/{self.session_id}",
            200
        )
        
        if success and 'title' in response:
            self.log(f"Session details: {response['title']} - {response.get('status')}")
            
            # Check for new v2.0 authenticity fields
            if 'authenticity_score' in response:
                self.log(f"✅ Authenticity score field found: {response.get('authenticity_score')}")
            
            if 'understanding_level' in response:
                self.log(f"✅ Understanding level field found: {response.get('understanding_level')}")
                
            if 'ai_assistance_count' in response:
                self.log(f"✅ AI assistance count field found: {response.get('ai_assistance_count')}")
                
            return True
        return False

    def test_validate_candidate_access(self) -> bool:
        """Test candidate access validation"""
        if not self.access_token:
            self.log("No access token available for testing", "WARNING")
            return False
            
        success, response = self.run_test(
            "Validate Candidate Access",
            "POST",
            "interviews/validate",
            200,
            data={"access_token": self.access_token}
        )
        
        if success and 'title' in response:
            self.log(f"Access validated for: {response['title']}")
            return True
        return False

    def test_start_interview(self) -> bool:
        """Test starting an interview"""
        if not self.access_token:
            self.log("No access token available for testing", "WARNING")
            return False
            
        success, response = self.run_test(
            "Start Interview",
            "POST",
            "interviews/start",
            200,
            data={"access_token": self.access_token}
        )
        
        if success and 'question' in response:
            question = response['question']
            self.log(f"Interview started - Question 1: {question.get('question_text', '')[:50]}...")
            # Store question ID for AI assistant testing
            self.question_id = question.get('id')
            # Check for AI assistant features
            if response.get('ai_assistant_enabled'):
                self.log("✅ AI Assistant is enabled for this interview")
            if response.get('ai_assistant_notice'):
                self.log(f"AI Assistant notice: {response['ai_assistant_notice'][:50]}...")
            return True
        return False

    def test_ai_assistant_chat(self) -> bool:
        """Test AI Assistant chat endpoint (NEW v2.0 feature)"""
        if not self.access_token or not hasattr(self, 'question_id') or not self.question_id:
            self.log("No access token or question ID available for AI assistant testing", "WARNING")
            return False
            
        success, response = self.run_test(
            "AI Assistant Chat",
            "POST",
            "assist/chat",
            200,
            data={
                "access_token": self.access_token,
                "question_id": self.question_id,
                "message": "Can you explain what this question is asking for?"
            }
        )
        
        if success and 'response' in response:
            self.log(f"AI Assistant responded: {response['response'][:50]}...")
            if 'query_intent' in response:
                self.log(f"Query intent classified as: {response['query_intent']}")
            if 'messages_remaining' in response:
                self.log(f"Messages remaining: {response['messages_remaining']}")
            return True
        return False

    def test_ai_assistant_history(self) -> bool:
        """Test AI Assistant chat history endpoint"""
        if not self.access_token or not hasattr(self, 'question_id') or not self.question_id:
            self.log("No access token or question ID available for history testing", "WARNING")
            return False
            
        success, response = self.run_test(
            "AI Assistant History",
            "GET",
            f"assist/history/{self.access_token}/{self.question_id}",
            200
        )
        
        if success and 'history' in response:
            history_count = len(response['history'])
            self.log(f"AI Assistant history retrieved: {history_count} messages")
            return True
        return False

    def test_logout(self) -> bool:
        """Test user logout"""
        success, _ = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

    def test_brute_force_protection(self) -> bool:
        """Test brute force protection"""
        self.log("Testing brute force protection (5 failed attempts)...")
        
        # Try 6 failed login attempts
        failed_attempts = 0
        for i in range(6):
            success, response = self.run_test(
                f"Failed Login Attempt {i+1}",
                "POST",
                "auth/login",
                401 if i < 5 else 429,  # Expect 429 on 6th attempt
                data={"email": "admin@aiproctor.com", "password": "wrongpassword"}
            )
            if success:
                failed_attempts += 1
                
        return failed_attempts >= 5

    def run_all_tests(self) -> bool:
        """Run all tests in sequence"""
        self.log("Starting AI Interview Assistant Backend Tests")
        self.log("=" * 60)
        
        # Basic connectivity
        if not self.test_health_check():
            self.log("Health check failed - stopping tests", "ERROR")
            return False
            
        # Authentication tests
        self.test_get_current_user()
        self.test_invalid_login()
        self.test_register_recruiter()
        
        # Dashboard and session management
        self.test_dashboard_stats()
        self.test_create_interview_session()
        self.test_list_sessions()
        self.test_get_session_details()
        
        # Interview flow
        self.test_validate_candidate_access()
        self.test_start_interview()
        
        # NEW v2.0: AI Assistant features
        self.test_ai_assistant_chat()
        self.test_ai_assistant_history()
        
        # Security tests
        self.test_brute_force_protection()
        
        # Cleanup
        self.test_logout()
        
        # Results
        self.log("=" * 60)
        self.log(f"Tests completed: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Success rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = AIInterviewTester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        return 1
    except Exception as e:
        print(f"Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())