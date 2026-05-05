#!/usr/bin/env node
// Safe admin create/update script
// - Reads MONGO_URI from backend/.env (dotenv)
// - Accepts ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD env vars OR --name= --email= --password= CLI args
// - Prompts for name, email, password (password input is masked) if values not provided
// - Upserts a user with role 'admin' (uses Mongoose model so password hashing runs)

const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const readline = require('readline');

// Load .env from backend directory (script runs from backend)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI not set in environment or .env');
  process.exit(1);
}

const User = require('../models/User');

// Simple CLI arg parser for --name= --email= --password=
const cliArgs = {};
process.argv.slice(2).forEach((arg) => {
  if (arg.startsWith('--')) {
    const eq = arg.indexOf('=');
    if (eq > 2) {
      const key = arg.slice(2, eq);
      const val = arg.slice(eq + 1);
      cliArgs[key] = val;
    }
  }
});

function prompt(question, hide = false) {
  if (!hide) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
  }

  // Masked input for password
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = '';

    stdout.write(question);
    readline.emitKeypressEvents(stdin);
    if (stdin.isTTY) stdin.setRawMode(true);

    function onKeypress(str, key) {
      if (key && (key.name === 'return' || key.name === 'enter')) {
        stdout.write('\n');
        if (stdin.isTTY) stdin.setRawMode(false);
        stdin.removeListener('keypress', onKeypress);
        resolve(value);
      } else if (key && key.name === 'backspace') {
        value = value.slice(0, -1);
        stdout.clearLine && stdout.clearLine(0);
        stdout.cursorTo && stdout.cursorTo(0);
        stdout.write(question + '*'.repeat(value.length));
      } else if (key && key.ctrl && key.name === 'c') {
        stdout.write('\n');
        process.exit(1);
      } else {
        value += str;
        stdout.write('*');
      }
    }

    stdin.on('keypress', onKeypress);
  });
}

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    // Modern mongoose (v6+) uses sane defaults; passing useNewUrlParser/useUnifiedTopology
    // is no longer supported and causes an error. Use the simple call below.
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // Prefer CLI args, then ENV, then interactive prompt
    const nameArg = cliArgs.name || process.env.ADMIN_NAME || null;
    const emailArg = cliArgs.email || process.env.ADMIN_EMAIL || null;
    const passArg = cliArgs.password || process.env.ADMIN_PASSWORD || null;

    const name = nameArg ? String(nameArg).trim() : (await prompt('Admin full name: ')).trim();
    const email = emailArg ? String(emailArg).trim().toLowerCase() : (await prompt('Admin email: ')).trim().toLowerCase();

    let password = passArg ? String(passArg) : null;
    if (!password) {
      password = await prompt('Admin password: ', true);
    }

    if (!name) {
      console.error('Name is required');
      process.exit(1);
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      console.error('Valid email is required');
      process.exit(1);
    }
    if (!password || password.length < 6) {
      console.error('Password must be at least 6 characters');
      process.exit(1);
    }

    // Try to find existing user
    let user = await User.findOne({ email }).select('+password');
    if (user) {
      console.log(`Found existing user with email ${email}. Updating to admin.`);
      user.name = name;
      user.password = password; // will be hashed by pre-save hook
      user.role = 'admin';
      await user.save();
      console.log('Admin user updated successfully.');
    } else {
      console.log('Creating new admin user...');
      user = new User({ name, email, password, role: 'admin' });
      await user.save();
      console.log('Admin user created successfully.');
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
