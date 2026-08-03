// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "hivenixai.firebaseapp.com",
    projectId: "hivenixai",
    storageBucket: "hivenixai.firebasestorage.app",
    messagingSenderId: "889777040636",
    appId: "1:889777040636:web:ef22630b38d2aa85d87b79"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const googleprovider = new GoogleAuthProvider()