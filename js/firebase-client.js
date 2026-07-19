const firebaseConfig = {
  apiKey: "AIzaSyCplX3nVWnaDtWjs0nyNXb_SsBDBpBL1SE",
  authDomain: "quizpdfai.firebaseapp.com",
  projectId: "quizpdfai",
  storageBucket: "quizpdfai.firebasestorage.app",
  messagingSenderId: "730971484675",
  appId: "1:730971484675:web:da1824823335ba8ed31436",
  measurementId: "G-8Z2FEJQX5G"
};

// Initialize Firebase using compat globals
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const FirebaseClient = {
  auth,
  db,
  currentUser: null,
  
  signInWithGoogle: async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
      return { success: true };
    } catch (error) {
      console.error("[Firebase] Sign-in error:", error);
      return { success: false, error: error.message };
    }
  },

  logOut: async () => {
    try {
      await auth.signOut();
      return { success: true };
    } catch (error) {
      console.error("[Firebase] Sign-out error:", error);
      return { success: false, error: error.message };
    }
  },

  onUserChange: (callback) => {
    return auth.onAuthStateChanged((user) => {
      FirebaseClient.currentUser = user;
      callback(user);
    });
  },

  syncDataToCloud: async (data) => {
    if (!FirebaseClient.currentUser) return false;
    try {
      const userRef = db.collection('users').doc(FirebaseClient.currentUser.uid);
      await userRef.set(data, { merge: true });
      return true;
    } catch (error) {
      console.error("[Firebase] Sync error:", error);
      return false;
    }
  },

  fetchDataFromCloud: async () => {
    if (!FirebaseClient.currentUser) return null;
    try {
      const userRef = db.collection('users').doc(FirebaseClient.currentUser.uid);
      const snap = await userRef.get();
      if (snap.exists) {
        return snap.data();
      }
      return null;
    } catch (error) {
      console.error("[Firebase] Fetch error:", error);
      return null;
    }
  }
};

window.FirebaseClient = FirebaseClient;
