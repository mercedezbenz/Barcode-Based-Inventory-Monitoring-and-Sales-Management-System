/**
 * Google Drive Service
 * Handles OAuth 2.0 authentication and file operations with Google Drive API
 */

// Google API configuration
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ""
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
const SCOPES = "https://www.googleapis.com/auth/drive.file"

// Types
export interface GoogleDriveFile {
    id: string
    name: string
    mimeType: string
    webViewLink: string
    thumbnailLink?: string
    createdTime?: string
}

export interface GoogleDriveUploadResult {
    fileId: string
    webViewLink: string
    webContentLink?: string
    success: boolean
    error?: string
}

export interface GoogleUserProfile {
    id: string
    email: string
    name: string
    imageUrl: string
}

// State
let gapiLoaded = false
let gisLoaded = false
let tokenClient: google.accounts.oauth2.TokenClient | null = null
let accessToken: string | null = null
let userProfile: GoogleUserProfile | null = null

// Callbacks for auth state changes
type AuthCallback = (isAuthenticated: boolean, profile: GoogleUserProfile | null) => void
const authCallbacks: AuthCallback[] = []

/**
 * Register a callback to be notified when auth state changes
 */
export function onAuthStateChange(callback: AuthCallback): () => void {
    authCallbacks.push(callback)
    // Immediately call with current state
    callback(!!accessToken, userProfile)
    // Return unsubscribe function
    return () => {
        const index = authCallbacks.indexOf(callback)
        if (index > -1) authCallbacks.splice(index, 1)
    }
}

/**
 * Notify all auth callbacks of state change
 */
function notifyAuthChange() {
    authCallbacks.forEach(cb => cb(!!accessToken, userProfile))
}

/**
 * Wait for a global object to be available
 */
function waitForGlobal(name: "gapi" | "google", timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now()
        const check = () => {
            if (name === "gapi" && window.gapi) {
                resolve()
            } else if (name === "google" && window.google?.accounts?.oauth2) {
                resolve()
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout waiting for ${name} to load`))
            } else {
                setTimeout(check, 100)
            }
        }
        check()
    })
}

/**
 * Load the Google API (gapi) library
 */
export function loadGapiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Cannot load gapi on server"))
            return
        }

        // If gapi is already available, resolve immediately
        if (window.gapi) {
            console.log("[GoogleDrive] gapi already available")
            gapiLoaded = true
            resolve()
            return
        }

        // Check if script already exists but gapi not ready
        if (document.getElementById("gapi-script")) {
            console.log("[GoogleDrive] gapi script exists, waiting for global...")
            waitForGlobal("gapi").then(() => {
                gapiLoaded = true
                resolve()
            }).catch(reject)
            return
        }

        console.log("[GoogleDrive] Loading gapi script...")
        const script = document.createElement("script")
        script.id = "gapi-script"
        script.src = "https://apis.google.com/js/api.js"
        script.async = true
        script.defer = true
        script.onload = () => {
            console.log("[GoogleDrive] gapi script loaded, waiting for global...")
            waitForGlobal("gapi").then(() => {
                console.log("[GoogleDrive] gapi global available")
                gapiLoaded = true
                resolve()
            }).catch(reject)
        }
        script.onerror = () => reject(new Error("Failed to load Google API script"))
        document.head.appendChild(script)
    })
}

/**
 * Load the Google Identity Services (GIS) library
 */
export function loadGisScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Cannot load GIS on server"))
            return
        }

        // If google.accounts.oauth2 is already available, resolve immediately
        if (window.google?.accounts?.oauth2) {
            console.log("[GoogleDrive] GIS already available")
            gisLoaded = true
            resolve()
            return
        }

        // Check if script already exists but google not ready
        if (document.getElementById("gis-script")) {
            console.log("[GoogleDrive] GIS script exists, waiting for global...")
            waitForGlobal("google").then(() => {
                gisLoaded = true
                resolve()
            }).catch(reject)
            return
        }

        console.log("[GoogleDrive] Loading GIS script...")
        const script = document.createElement("script")
        script.id = "gis-script"
        script.src = "https://accounts.google.com/gsi/client"
        script.async = true
        script.defer = true
        script.onload = () => {
            console.log("[GoogleDrive] GIS script loaded, waiting for global...")
            waitForGlobal("google").then(() => {
                console.log("[GoogleDrive] GIS global available")
                gisLoaded = true
                resolve()
            }).catch(reject)
        }
        script.onerror = () => reject(new Error("Failed to load Google Identity Services script"))
        document.head.appendChild(script)
    })
}


/**
 * Initialize the Google Drive client
 */
export async function initGoogleDriveClient(): Promise<void> {
    console.log("[GoogleDrive] Starting initialization...")
    console.log("[GoogleDrive] Client ID:", GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 20)}...` : "NOT SET")
    console.log("[GoogleDrive] API Key:", GOOGLE_API_KEY ? `${GOOGLE_API_KEY.substring(0, 10)}...` : "NOT SET")

    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "") {
        console.error("[GoogleDrive] ERROR: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set!")
        throw new Error("Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local")
    }

    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "") {
        console.error("[GoogleDrive] ERROR: NEXT_PUBLIC_GOOGLE_API_KEY is not set!")
        throw new Error("Google API Key is not configured. Please set NEXT_PUBLIC_GOOGLE_API_KEY in .env.local")
    }

    try {
        // Load both scripts
        console.log("[GoogleDrive] Loading Google API scripts...")
        await Promise.all([loadGapiScript(), loadGisScript()])
        console.log("[GoogleDrive] Scripts loaded successfully")

        // Initialize gapi client
        console.log("[GoogleDrive] Initializing gapi.client...")
        await new Promise<void>((resolve, reject) => {
            window.gapi.load("client", {
                callback: () => {
                    console.log("[GoogleDrive] gapi.client loaded")
                    resolve()
                },
                onerror: () => {
                    console.error("[GoogleDrive] Failed to load gapi.client")
                    reject(new Error("Failed to load gapi client"))
                },
            })
        })

        await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        })
        console.log("[GoogleDrive] gapi.client initialized")

        // Initialize token client
        console.log("[GoogleDrive] Initializing token client...")
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response: google.accounts.oauth2.TokenResponse) => {
                console.log("[GoogleDrive] Token callback received:", response.error ? `Error: ${response.error}` : "Success")
                if (response.error) {
                    console.error("[GoogleDrive] Token error:", response.error)
                    accessToken = null
                    userProfile = null
                    notifyAuthChange()
                    // Reject pending sign-in if exists
                    if (pendingSignInReject) {
                        pendingSignInReject(new Error((response as any).error_description || response.error))
                        pendingSignInResolve = null
                        pendingSignInReject = null
                    }
                    return
                }
                accessToken = response.access_token
                console.log("[GoogleDrive] Access token received, fetching user profile...")
                // Fetch user profile after getting token
                fetchUserProfile().then(() => {
                    console.log("[GoogleDrive] User profile fetched")
                    // Resolve pending sign-in if exists
                    if (pendingSignInResolve) {
                        pendingSignInResolve()
                        pendingSignInResolve = null
                        pendingSignInReject = null
                    }
                })
            },
        })

        console.log("[GoogleDrive] Client initialized successfully!")
    } catch (error) {
        console.error("[GoogleDrive] Failed to initialize client:", error)
        throw error
    }
}

/**
 * Fetch the authenticated user's profile
 */
async function fetchUserProfile(): Promise<void> {
    if (!accessToken) return


    try {
        const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const data = await response.json()
        userProfile = {
            id: data.id,
            email: data.email,
            name: data.name,
            imageUrl: data.picture,
        }
        notifyAuthChange()
    } catch (error) {
        console.error("[GoogleDrive] Failed to fetch user profile:", error)
    }
}

/**
 * Sign in to Google Drive
 */
let pendingSignInResolve: (() => void) | null = null
let pendingSignInReject: ((error: Error) => void) | null = null

export async function signInToGoogle(): Promise<void> {
    if (!tokenClient) {
        await initGoogleDriveClient()
    }

    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error("Token client not initialized"))
            return
        }

        // Store resolve/reject for use in the token callback
        pendingSignInResolve = resolve
        pendingSignInReject = reject

        // Always show account picker so users can switch accounts
        tokenClient.requestAccessToken({ prompt: "select_account" })
    })
}

// Update the initGoogleDriveClient to handle pending sign-in

/**
 * Sign out from Google Drive
 */
export function signOutFromGoogle(): void {
    if (accessToken) {
        window.google.accounts.oauth2.revoke(accessToken, () => {
            console.log("[GoogleDrive] Token revoked")
        })
    }
    accessToken = null
    userProfile = null
    notifyAuthChange()
}

/**
 * Check if user is authenticated with Google
 */
export function isGoogleAuthenticated(): boolean {
    return !!accessToken
}

/**
 * Get current user profile
 */
export function getGoogleUserProfile(): GoogleUserProfile | null {
    return userProfile
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
    return accessToken
}

/**
 * Upload a file to Google Drive
 */
export async function uploadFileToGoogleDrive(
    file: File,
    folderName?: string,
    onProgress?: (progress: number) => void
): Promise<GoogleDriveUploadResult> {
    if (!accessToken) {
        throw new Error("Not authenticated with Google. Please sign in first.")
    }

    try {
        // Step 1: Create or find folder if specified
        let folderId: string | null = null
        if (folderName) {
            folderId = await findOrCreateFolder(folderName)
        }

        // Step 2: Prepare file metadata
        const metadata: any = {
            name: file.name,
            mimeType: file.type,
        }
        if (folderId) {
            metadata.parents = [folderId]
        }

        // Step 3: Create multipart request
        const boundary = "-------314159265358979323846"
        const delimiter = "\r\n--" + boundary + "\r\n"
        const close_delim = "\r\n--" + boundary + "--"

        // Read file as base64
        const base64Data = await fileToBase64(file)

        const multipartRequestBody =
            delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(metadata) +
            delimiter +
            "Content-Type: " + file.type + "\r\n" +
            "Content-Transfer-Encoding: base64\r\n\r\n" +
            base64Data +
            close_delim

        // Step 4: Upload file
        onProgress?.(10)

        const response = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": `multipart/related; boundary="${boundary}"`,
                },
                body: multipartRequestBody,
            }
        )

        onProgress?.(80)

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error?.message || "Upload failed")
        }

        const fileData = await response.json()
        console.log("[GoogleDrive] File uploaded:", fileData)

        onProgress?.(90)

        // Step 5: Make file publicly viewable
        await makeFilePublic(fileData.id)

        onProgress?.(100)

        // Use lh3.googleusercontent.com format for direct image embedding (works best for avatars/images)
        const directImageUrl = `https://lh3.googleusercontent.com/d/${fileData.id}`

        return {
            fileId: fileData.id,
            webViewLink: directImageUrl, // Use direct image URL instead of view link
            webContentLink: fileData.webContentLink,
            success: true,
        }
    } catch (error: any) {
        console.error("[GoogleDrive] Upload failed:", error)
        return {
            fileId: "",
            webViewLink: "",
            success: false,
            error: error.message || "Upload failed",
        }
    }
}

/**
 * Find or create a folder in Google Drive
 */
async function findOrCreateFolder(folderName: string): Promise<string> {
    // Search for existing folder
    const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    )

    const searchData = await searchResponse.json()

    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id
    }

    // Create new folder
    const folderMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
    }

    const createResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files?fields=id",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(folderMetadata),
        }
    )

    const folderData = await createResponse.json()
    return folderData.id
}

/**
 * Make a file publicly viewable (anyone with link can view)
 */
async function makeFilePublic(fileId: string): Promise<void> {
    await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role: "reader",
                type: "anyone",
            }),
        }
    )
}

/**
 * Get file URL from Google Drive
 */
export async function getGoogleDriveFileUrl(fileId: string): Promise<string | null> {
    if (!accessToken) {
        throw new Error("Not authenticated with Google")
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        )

        if (!response.ok) {
            throw new Error("Failed to get file info")
        }

        const data = await response.json()
        return data.webViewLink
    } catch (error) {
        console.error("[GoogleDrive] Failed to get file URL:", error)
        return null
    }
}

/**
 * Convert file to base64
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            const result = reader.result as string
            // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = result.split(",")[1]
            resolve(base64)
        }
        reader.onerror = reject
    })
}

