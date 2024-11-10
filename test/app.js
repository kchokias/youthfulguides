// Import Firebase functions from the SDKs
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyALCv510_VHgpz0vvbbQ2sc6dxYiw9fc-w",
  authDomain: "youthfulguides-7ce3b.firebaseapp.com",
  projectId: "youthfulguides-7ce3b",
  storageBucket: "youthfulguides-7ce3b.appspot.com", // Fixed storage bucket URL
  messagingSenderId: "159642827328",
  appId: "1:159642827328:web:b1d5ef9438a4110fe53da5",
  measurementId: "G-P93K9Q0DMM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Event listener for login button
document.getElementById("loginButton").addEventListener("click", () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("User signed in:", result.user);
        })
        .catch((error) => {
            console.error("Error during sign-in:", error);
        });
});

// Event listener for logout button
document.getElementById("logoutButton").addEventListener("click", () => {
    signOut(auth)
        .then(() => {
            console.log("User signed out");
        })
        .catch((error) => {
            console.error("Error during sign-out:", error);
        });
});

// Monitor authentication state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("userInfo").hidden = false;
        document.getElementById("loginButton").hidden = true;
        document.getElementById("userDetails").textContent = `Hello, ${user.displayName}`;
    } else {
        document.getElementById("userInfo").hidden = true;
        document.getElementById("loginButton").hidden = false;
    }
});