const admin = require('firebase-admin');

// চেক করা সিক্রেট আছে কিনা
if (!process.env.SOURCE_FIREBASE_SA) {
    console.error('❌ SOURCE_FIREBASE_SA সিক্রেট নেই!');
    process.exit(1);
}

// সোর্স প্রোজেক্ট কানেক্ট (যেখানে ডাটা আছে)
let sourceServiceAccount;
try {
    sourceServiceAccount = JSON.parse(process.env.SOURCE_FIREBASE_SA);
    console.log('✅ সোর্স প্রোজেক্ট JSON ঠিক আছে');
} catch (e) {
    console.error('❌ JSON পার্স করতে ব্যর্থ:', e.message);
    process.exit(1);
}

const sourceApp = admin.initializeApp({
    credential: admin.credential.cert(sourceServiceAccount)
}, 'sourceApp');
const sourceDb = sourceApp.firestore();

// টার্গেট প্রোজেক্ট (আপনার বর্তমান অ্যাপের ফায়ারবেস)
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const targetDb = admin.firestore();

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
