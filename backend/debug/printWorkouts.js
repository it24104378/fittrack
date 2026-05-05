/* Debug script to print workouts for a given userId.
   Usage (Windows cmd.exe):
     set MONGO_URI=<your_mongo_uri> && node debug\printWorkouts.js <userId>
*/

const mongoose = require('mongoose');
const Workout = require('../models/Workout');

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node debug\\printWorkouts.js <userId>');
    process.exit(1);
  }
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Please set MONGO_URI environment variable');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Try multiple owner field variants
  const queries = [
    { user: userId },
    { userId },
    { owner: userId },
    { createdBy: userId },
  ];

  for (const q of queries) {
    try {
      const found = await Workout.find(q).lean();
      console.log('\nQuery:', JSON.stringify(q), '->', found.length, 'results');
      if (found.length > 0) {
        // print first 5
        found.slice(0, 5).forEach((w, i) => {
          console.log(`\n--- Workout ${i + 1} ---`);
          console.log('id:', w._id);
          console.log('title:', w.title);
          console.log('user/owner fields:', { user: w.user, userId: w.userId, owner: w.owner, createdBy: w.createdBy });
          console.log('category:', w.category);
          console.log('status:', w.status);
          console.log('durationMinutes:', w.durationMinutes);
          console.log('exercises (first 5):', Array.isArray(w.exercises) ? w.exercises.slice(0,5) : w.exercises);
        });
        break; // stop after first matching query
      }
    } catch (err) {
      console.error('Query error for', q, err.message);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

