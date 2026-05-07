// Seed categories and subcategories for Decktago Admin inventory system
// Run this script to populate the categories collection in Firestore

import { initializeApp } from "firebase/app"
import { getFirestore, doc, setDoc } from "firebase/firestore"

// Firebase config (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyBvOsda_wGGsT1f1tr_6oA9HZsgjUMdWWs",
  authDomain: "decktago.firebaseapp.com",
  projectId: "decktago",
  storageBucket: "decktago.firebasestorage.app",
  messagingSenderId: "590323015469",
  appId: "1:590323015469:web:8e5b7c8f9d0e1a2b3c4d5e",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Categories data with ALL CAPS names and lowercase subcategories
const categoriesData = [
  {
    name: "BEEF",
    subcategories: ["bf shortplate trims", "bf shortplate meat trims", "bf trims", "for ground", "for throw"],
  },
  {
    name: "CHICKEN",
    subcategories: [
      "backtrim",
      "backtrim alt",
      "c legbone",
      "c skin",
      "c skinandfat",
      "c-tail",
      "c trims 4 ground",
      "c-trims marinated",
      "cooked assorted bones",
      "for disposal",
      "cooked assorted bones",
    ],
  },
  {
    name: "PORK",
    subcategories: [
      "abodo cut",
      "pork bias",
      "bbq trims",
      "costal ribs",
      "p cfat",
      "p loinbone",
      "p legbone",
      "p tailbone",
      "p ear",
      "p tail",
      "p liver",
      "belly skin",
      "ham skin",
      "jowl skin",
      "shoulder skin",
      "skin strips",
      "pork feet sliced",
      "for ground",
      "paypay",
      "petfood",
      "ribstick",
      "hardbone",
      "bones for throw",
      "litid",
      "pata hock",
      "bbq ribs reject",
      "pata hock reject",
      "pata hook offsize",
      "cheekmeat trims",
      "shoulder trims",
      "pata strim",
      "loin strim",
      "jowl meat trims",
      "hamleg trims",
      "ham trims",
      "belly trims",
      "boiled pata reject",
      "boiled jowl trims",
      "boiled belly trims",
      "pork skin",
      "loin skin",
      "cheekmeat skins",
      "skin strips",
      "shoulder skins",
      "jowl skins",
      "ham skin",
      "belly skins",
      "p liver",
      "tail",
      "ear",
      "tailbone",
    ],
  },
  {
    name: "SAWDUST",
    subcategories: ["sawdust"],
  },
  {
    name: "GROUND BEEF",
    subcategories: ["ground beef regular", "ground beef special"],
  },
  {
    name: "CHICKEN PRODUCTS",
    subcategories: ["clq diced", "c leg fillet 26g to 28g", "sample", "c trims 4 boiling"],
  },
  {
    name: "PORK PRODUCTS",
    subcategories: [
      "backfat sliced",
      "belly blso",
      "belly blsl kimbob",
      "boston butt",
      "ham 4 pchop",
      "shoulder 4sliceanddice",
      "jowl so",
      "loin blsl",
      "jowl sl so sisig",
      "jowl sl",
      "ham 4 slice and dice",
    ],
  },
  {
    name: "RETAIL PRODUCTS",
    subcategories: ["pinoy p bbq 6 sticks", "p chop 500g", "p kasim 500g", "pang ihaw 500g", "ground pork 500g"],
  },
]

async function seedCategories() {
  try {
    console.log("[v0] Starting to seed categories...")

    for (const category of categoriesData) {
      const categoryDoc = doc(db, "categories", category.name)

      await setDoc(categoryDoc, {
        name: category.name,
        subcategories: category.subcategories,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      console.log(`[v0] Created category: ${category.name} with ${category.subcategories.length} subcategories`)
    }

    console.log("[v0] All categories seeded successfully!")
    console.log(`[v0] Total categories created: ${categoriesData.length}`)
  } catch (error) {
    console.error("[v0] Error seeding categories:", error)
  }
}

// Run the function
seedCategories()
