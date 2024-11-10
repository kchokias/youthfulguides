// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyALCv510_VHgpz0vvbbQ2sc6dxYiw9fc-w",
    authDomain: "youthfulguides-7ce3b.firebaseapp.com",
    projectId: "youthfulguides-7ce3b",
    storageBucket: "youthfulguides-7ce3b.appspot.com",
    messagingSenderId: "159642827328",
    appId: "1:159642827328:web:b1d5ef9438a4110fe53da5",
    measurementId: "G-P93K9Q0DMM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// Log in button
document.getElementById("loginButton").addEventListener("click", () => {
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("User signed in:", result.user);
        })
        .catch((error) => {
            console.error("Error during sign-in:", error);
        });
});

// Log out button
document.getElementById("logoutButton").addEventListener("click", () => {
    auth.signOut()
        .then(() => {
            console.log("User signed out");
        })
        .catch((error) => {
            console.error("Error during sign-out:", error);
        });
});

// Monitor authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById("userInfo").hidden = false;
        document.getElementById("loginButton").hidden = true;
        document.getElementById("userDetails").textContent = `Hello, ${user.displayName}`;
    } else {
        document.getElementById("userInfo").hidden = true;
        document.getElementById("loginButton").hidden = false;
    }
});