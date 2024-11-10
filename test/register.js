// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyALCv510_VHgpz0vvbbQ2sc6dxYiw9fc-w",
  authDomain: "youthfulguides-7ce3b.firebaseapp.com",
  projectId: "youthfulguides-7ce3b",
  storageBucket: "youthfulguides-7ce3b.firebasestorage.app",
  messagingSenderId: "159642827328",
  appId: "1:159642827328:web:b1d5ef9438a4110fe53da5",
  measurementId: "G-P93K9Q0DMM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
