"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, ExternalLink, Copy, Check } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read their own data, admins can read all
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Inventory collection - authenticated users can read, admins and staff can write
    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }
    
    // Categories collection - authenticated users can read, admins can write
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Documents collection - authenticated users can read, admins and staff can write
    match /documents/{documentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }
    
    // Deliveries collection - authenticated users can read, all roles can write
    match /deliveries/{deliveryId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff', 'driver'];
    }
    
    // Stock movements collection - authenticated users can read, admins and staff can write
    match /stock_movements/{movementId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }
  }
}`

export function FirebaseSetupGuide() {
  const { createDefaultUser, firebaseError } = useAuth()
  const [copied, setCopied] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [userCreated, setUserCreated] = useState(false)
  const [rulesApplied, setRulesApplied] = useState(false)

  const copyRules = async () => {
    await navigator.clipboard.writeText(FIRESTORE_RULES)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateUser = async () => {
    setCreatingUser(true)
    try {
      await createDefaultUser()
      setUserCreated(true)
    } catch (error) {
      console.error("Failed to create user:", error)
    }
    setCreatingUser(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Decktago Admin Setup</h1>
          <p className="text-gray-600 mt-2">Complete these steps to configure your Firebase project</p>
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">Current Issue: Firestore Permission Denied</p>
            <p className="text-red-600 text-xs">Your app cannot access the database until security rules are applied</p>
          </div>
        </div>

        {firebaseError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{firebaseError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          {/* Step 1: Apply Firestore Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span
                  className={`${rulesApplied ? "bg-green-500" : "bg-blue-500"} text-white rounded-full w-6 h-6 flex items-center justify-center text-sm`}
                >
                  {rulesApplied ? <CheckCircle className="w-4 h-4" /> : "1"}
                </span>
                Apply Firestore Security Rules
              </CardTitle>
              <CardDescription>Configure your Firebase project to allow proper data access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>This is the most critical step!</strong> Without these rules, the app will show
                  &quot;permission-denied&quot; errors and won&apos;t work.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">Step-by-step instructions:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>
                    Open{" "}
                    <a
                      href="https://console.firebase.google.com/project/decktago/firestore/rules"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      Firebase Console - Firestore Rules <ExternalLink className="w-3 h-3" />
                    </a>{" "}
                    (this link goes directly to your project&apos;s rules)
                  </li>
                  <li>You&apos;ll see a code editor with existing rules</li>
                  <li>
                    <strong>Select ALL existing text</strong> and delete it
                  </li>
                  <li>Copy the rules below and paste them into the editor</li>
                  <li>
                    Click the blue <strong>&quot;Publish&quot;</strong> button
                  </li>
                  <li>Wait for the &quot;Rules published successfully&quot; message</li>
                </ol>
              </div>

              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg relative">
                <Button
                  onClick={copyRules}
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 bg-gray-800 border-gray-600 hover:bg-gray-700"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Rules"}
                </Button>
                <pre className="text-xs overflow-x-auto pr-20">
                  <code>{FIRESTORE_RULES}</code>
                </pre>
              </div>

              <Button
                onClick={() => setRulesApplied(true)}
                variant={rulesApplied ? "default" : "outline"}
                className="w-full"
                disabled={rulesApplied}
              >
                {rulesApplied ? "✓ Rules Applied Successfully" : "I&apos;ve Applied the Rules"}
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Create Admin User */}
          <Card className={!rulesApplied ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span
                  className={`${userCreated ? "bg-green-500" : "bg-blue-500"} text-white rounded-full w-6 h-6 flex items-center justify-center text-sm`}
                >
                  {userCreated ? <CheckCircle className="w-4 h-4" /> : "2"}
                </span>
                Create Admin User
              </CardTitle>
              <CardDescription>Set up the default admin account for the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!rulesApplied && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Complete Step 1 first before creating the admin user.</AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-gray-600">
                After applying the Firestore rules, create the admin user account:
              </p>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium">Default Admin Credentials:</p>
                <p className="text-sm text-gray-600">Email: admin@decktago.com</p>
                <p className="text-sm text-gray-600">Password: admin123</p>
              </div>

              <Button onClick={handleCreateUser} disabled={creatingUser || !rulesApplied} className="w-full">
                {creatingUser ? "Creating Admin User..." : "Create Admin User"}
              </Button>

              {userCreated && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>Admin user created successfully! You can now try logging in.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Test Login */}
          <Card className={!userCreated ? "opacity-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  3
                </span>
                Test Login
              </CardTitle>
              <CardDescription>Verify everything is working correctly</CardDescription>
            </CardHeader>
            <CardContent>
              {!userCreated && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Complete Steps 1 and 2 first before testing login.</AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-gray-600 mb-4">
                After completing steps 1 and 2, go to the login page and sign in with the admin credentials.
              </p>
              <Button
                onClick={() => (window.location.href = "/login")}
                variant="outline"
                className="w-full"
                disabled={!userCreated}
              >
                Go to Login Page
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Troubleshooting Section */}
        <Card>
          <CardHeader>
            <CardTitle>Still Getting Errors?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>If you still see permission errors:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Make sure you clicked &quot;Publish&quot; in the Firebase Console after pasting the rules</li>
              <li>Wait 1-2 minutes for the rules to propagate</li>
              <li>Refresh this page and try again</li>
              <li>Check that you&apos;re using the correct Firebase project (decktago)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
