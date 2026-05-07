// Test if environment variables are loaded
console.log("=== ENVIRONMENT VARIABLE TEST ===");
console.log("NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "âœ… FOUND" : "âŒ MISSING");
console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "âœ… FOUND" : "âŒ MISSING");
console.log("All NEXT_PUBLIC_ vars:", Object.keys(process.env).filter(k => k.startsWith("NEXT_PUBLIC_FIREBASE")));
