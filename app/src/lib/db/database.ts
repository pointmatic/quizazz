// Copyright (c) 2026 Pointmatic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import initSqlJs, { type Database } from 'sql.js';

const DB_STORE = 'database';
const DB_KEY = 'db';

export function getDbName(quizName: string): string {
	return `quizazz-${quizName}`;
}

const CURRENT_SCHEMA_VERSION = 1;

export function createSchema(db: Database): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS question_scores (
			question_id TEXT PRIMARY KEY,
			cumulative_score INTEGER NOT NULL DEFAULT 0
		)
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS session_answers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			question_id TEXT NOT NULL,
			selected_category TEXT NOT NULL,
			points INTEGER NOT NULL,
			timestamp INTEGER NOT NULL,
			elapsed_ms INTEGER NOT NULL DEFAULT 0
		)
	`);

	// Migrate existing databases before setting the version
	migrateSchema(db);

	db.run(`
		CREATE TABLE IF NOT EXISTS schema_version (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			version INTEGER NOT NULL
		)
	`);
	db.run('INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, ?)', [CURRENT_SCHEMA_VERSION]);
}

function getSchemaVersion(db: Database): number {
	const results = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'");
	if (results.length === 0 || results[0].values.length === 0) return 0;
	const versionResult = db.exec('SELECT version FROM schema_version WHERE id = 1');
	if (versionResult.length === 0 || versionResult[0].values.length === 0) return 0;
	return versionResult[0].values[0][0] as number;
}

function migrateSchema(db: Database): void {
	const version = getSchemaVersion(db);
	if (version < 1) {
		// Migration 0 → 1: add elapsed_ms column if missing
		const cols = db.exec("PRAGMA table_info(session_answers)");
		if (cols.length > 0) {
			const hasElapsedMs = cols[0].values.some((row) => row[1] === 'elapsed_ms');
			if (!hasElapsedMs) {
				db.run('ALTER TABLE session_answers ADD COLUMN elapsed_ms INTEGER NOT NULL DEFAULT 0');
			}
		}
		db.run(`
			CREATE TABLE IF NOT EXISTS schema_version (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				version INTEGER NOT NULL
			)
		`);
		db.run('INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, ?)', [CURRENT_SCHEMA_VERSION]);
	}
}

function openIndexedDB(dbName: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, 1);
		request.onupgradeneeded = () => {
			const idb = request.result;
			if (!idb.objectStoreNames.contains(DB_STORE)) {
				idb.createObjectStore(DB_STORE);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function loadFromIndexedDB(idb: IDBDatabase): Promise<Uint8Array | null> {
	return new Promise((resolve, reject) => {
		const tx = idb.transaction(DB_STORE, 'readonly');
		const store = tx.objectStore(DB_STORE);
		const request = store.get(DB_KEY);
		request.onsuccess = () => resolve(request.result ?? null);
		request.onerror = () => reject(request.error);
	});
}

function saveToIndexedDB(idb: IDBDatabase, data: Uint8Array): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = idb.transaction(DB_STORE, 'readwrite');
		const store = tx.objectStore(DB_STORE);
		const request = store.put(data, DB_KEY);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function initDatabase(quizName: string): Promise<Database> {
	const SQL = await initSqlJs({
		locateFile: (file: string) => `/${file}`
	});

	const idb = await openIndexedDB(getDbName(quizName));

	try {
		const saved = await loadFromIndexedDB(idb);
		if (saved) {
			const db = new SQL.Database(saved);
			createSchema(db);
			return db;
		}
	} catch {
		// Corrupt or missing — fall through to create fresh
	}

	const db = new SQL.Database();
	createSchema(db);
	return db;
}

export async function persistDatabase(db: Database, quizName: string): Promise<void> {
	const data = db.export();
	const idb = await openIndexedDB(getDbName(quizName));
	await saveToIndexedDB(idb, data);
}
