/**
 * Google Drive Firebase Integration
 * Helper functions to save Google Drive URLs to Firestore
 */

import { getFirebaseDb } from "@/lib/firebase-live"
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"

/**
 * Save a Google Drive URL to a user's Firestore document
 */
export async function saveGoogleDriveUrlToUser(
    userId: string,
    url: string,
    fieldName: string = "googleDrivePhotoUrl"
): Promise<void> {
    const db = getFirebaseDb()
    const userDocRef = doc(db, "users", userId)

    await updateDoc(userDocRef, {
        [fieldName]: url,
        updatedAt: serverTimestamp(),
    })

    console.log(`[GoogleDriveFirebase] Saved URL to users/${userId}.${fieldName}`)
}

/**
 * Save a Google Drive URL to any Firestore document
 */
export async function saveGoogleDriveUrl(
    collectionName: string,
    documentId: string,
    url: string,
    fieldName: string = "googleDriveUrl"
): Promise<void> {
    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, documentId)

    await updateDoc(docRef, {
        [fieldName]: url,
        updatedAt: serverTimestamp(),
    })

    console.log(`[GoogleDriveFirebase] Saved URL to ${collectionName}/${documentId}.${fieldName}`)
}

/**
 * Get a Google Drive URL from a Firestore document
 */
export async function getGoogleDriveUrl(
    collectionName: string,
    documentId: string,
    fieldName: string = "googleDriveUrl"
): Promise<string | null> {
    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, documentId)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
        return null
    }

    const data = docSnap.data()
    return data[fieldName] || null
}

/**
 * Save multiple Google Drive URLs to a document (for multiple file uploads)
 */
export async function saveMultipleGoogleDriveUrls(
    collectionName: string,
    documentId: string,
    urls: string[],
    fieldName: string = "googleDriveUrls"
): Promise<void> {
    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, documentId)

    // Get existing URLs and append new ones
    const docSnap = await getDoc(docRef)
    const existingUrls = docSnap.exists() ? (docSnap.data()[fieldName] || []) : []

    await updateDoc(docRef, {
        [fieldName]: [...existingUrls, ...urls],
        updatedAt: serverTimestamp(),
    })

    console.log(`[GoogleDriveFirebase] Saved ${urls.length} URLs to ${collectionName}/${documentId}.${fieldName}`)
}

/**
 * Upload to Google Drive and save URL to Firebase in one operation
 */
export async function uploadAndSaveToFirebase(
    uploadResult: { fileId: string; webViewLink: string; success: boolean },
    collectionName: string,
    documentId: string,
    fieldName: string = "googleDriveUrl"
): Promise<boolean> {
    if (!uploadResult.success || !uploadResult.webViewLink) {
        console.error("[GoogleDriveFirebase] Upload failed, cannot save to Firebase")
        return false
    }

    try {
        await saveGoogleDriveUrl(collectionName, documentId, uploadResult.webViewLink, fieldName)
        return true
    } catch (error) {
        console.error("[GoogleDriveFirebase] Failed to save URL to Firebase:", error)
        return false
    }
}
