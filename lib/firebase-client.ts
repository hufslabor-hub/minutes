'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBMdGaUCLVJbCaGSMJSSQhk27ax-rLNl60',
  authDomain: 'hufs-minutes.firebaseapp.com',
  projectId: 'hufs-minutes',
  storageBucket: 'hufs-minutes.firebasestorage.app',
  messagingSenderId: '130585661921',
  appId: '1:130585661921:web:145f60274ed45ca97c02a0',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
