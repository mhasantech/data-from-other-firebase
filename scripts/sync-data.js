const admin = require('firebase-admin');

// সোর্স প্রোজেক্ট (যেখান থেকে ডেটা আসবে)
if (!process.env.SOURCE_FIREBASE_SA) {
    console.error('❌ SOURCE_FIREBASE_SA সিক্রেন্ট নেই!');
    process.exit(1);
}
const sourceServiceAccount = JSON.parse(process.env.SOURCE_FIREBASE_SA);
const sourceApp = admin.initializeApp({
    credential: admin.credential.cert(sourceServiceAccount)
}, 'sourceApp');
const sourceDb = sourceApp.firestore();

// টার্গেট প্রোজেক্ট (আপনার বর্তমান অ্যাপ, যেখানে ডেটা সেভ হবে)
if (!process.env.TARGET_FIREBASE_SA) {
    console.error('❌ TARGET_FIREBASE_SA সিক্রেন্ট নেই!');
    process.exit(1);
}
const targetServiceAccount = JSON.parse(process.env.TARGET_FIREBASE_SA);
const targetApp = admin.initializeApp({
    credential: admin.credential.cert(targetServiceAccount)
}, 'targetApp');
const targetDb = targetApp.firestore();

async function syncCollection(collectionName) {
    console.log(`⏳ ${collectionName} সিঙ্ক শুরু...`);
    const snapshot = await sourceDb.collection(collectionName).get();
    console.log(`   পাওয়া গেছে ${snapshot.size} টি ডকুমেন্ট`);
    if (snapshot.empty) return 0;
    
    let batch = targetDb.batch();
    let count = 0;
    for (const doc of snapshot.docs) {
        const targetRef = targetDb.collection(collectionName).doc(doc.id);
        batch.set(targetRef, doc.data(), { merge: true });
        count++;
        if (count % 500 === 0) {
            await batch.commit();
            batch = targetDb.batch();
        }
    }
    if (count % 500 !== 0) await batch.commit();
    console.log(`✅ ${collectionName}: ${count} টি ডকুমেন্ট সিঙ্ক হয়েছে`);
    return count;
}

async function syncAll() {
    console.log('🚀 সিঙ্ক প্রসেস শুরু...');
    const collections = ['cse_detailed_data', 'dse_daily_index', 'dse_dividend_data'];
    let total = 0;
    for (const col of collections) {
        total += await syncCollection(col);
    }
    console.log(`🎉 মোট ${total} টি ডকুমেন্ট সিঙ্ক সম্পন্ন!`);
}

syncAll().catch(err => {
    console.error('❌ সিঙ্ক ব্যর্থ:', err);
    process.exit(1);
});
