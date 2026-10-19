# WaterTrack — Offline Water Distribution Management

**WaterTrack** is a production-quality, Android-first offline mobile application designed specifically for water bottle distribution businesses that supply 20L jars, 2L, 1L, and 500ml bottles to hotels, offices, shops, and individual clients.

Built with **React Native**, **Expo (SDK 58)**, **Expo Router**, **TypeScript**, and **SQLite (`expo-sqlite`)**, WaterTrack stores all business records persistently on the Android device and operates 100% offline without requiring internet access or an always-on backend server. An optional companion **Python 3 FastAPI** service is also provided for central report calculations, backup verification, and future synchronization.

---

## 🏗️ Architecture Overview

```
P1/
├── mobile/                        # React Native / Expo Android application
│   ├── app/                       # Expo Router file-based navigation
│   │   ├── _layout.tsx            # Root layout with SQLite init & ThemeProvider
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx        # Bottom tab bar (Dashboard, Deliveries, Customers, Reports)
│   │   │   ├── index.tsx          # Tab 1: Dashboard with live metrics & quick actions
│   │   │   ├── deliveries.tsx     # Tab 2: Deliveries log with date & type filters
│   │   │   ├── customers.tsx      # Tab 3: Customer directory with search & stats
│   │   │   └── reports.tsx        # Tab 4: Analytics with 4 charts & breakdown logs
│   │   ├── delivery/
│   │   │   ├── new.tsx            # Add Delivery 4-step wizard
│   │   │   ├── edit.tsx           # Edit Delivery with atomic transaction
│   │   │   └── [id].tsx           # Delivery details with itemized snapshots
│   │   ├── customer/
│   │   │   ├── new.tsx            # Register Customer with duplicate warnings
│   │   │   ├── edit.tsx           # Edit Customer info
│   │   │   └── [id].tsx           # Customer profile, history & safe archive/delete
│   │   ├── bottle-sizes.tsx       # Configurable bottle sizes & default pricing
│   │   └── settings.tsx           # Dark mode, DB stats, JSON backup/export & dev tools
│   ├── components/
│   │   ├── calendar/
│   │   │   └── DateRangePicker.tsx # Monday-first interactive calendar & quick presets
│   │   ├── charts/
│   │   │   ├── DailyBarChart.tsx         # SVG daily distribution bar chart
│   │   │   ├── BottleDistributionChart.tsx # SVG segmented bottle size breakdown
│   │   │   ├── TopCustomersChart.tsx     # Volume distribution by top customer
│   │   │   └── DistributionTrendChart.tsx # SVG line & area distribution trend
│   │   ├── common/
│   │   │   ├── Badge.tsx, Button.tsx, Card.tsx, EmptyState.tsx, Header.tsx, StatCard.tsx
│   │   ├── customer/
│   │   │   └── CustomerCard.tsx
│   │   └── delivery/
│   │       └── DeliveryItemCard.tsx
│   ├── context/
│   │   └── ThemeContext.tsx       # Light (default) & Dark theme switcher
│   ├── database/
│   │   ├── schema.ts              # SQLite tables, indexes & migration schema
│   │   └── database.ts            # expo-sqlite connection, WAL mode & foreign keys
│   ├── services/
│   │   ├── customerService.ts     # Customer CRUD, duplicate checks, safe archival
│   │   ├── bottleSizeService.ts   # Product configuration & activation
│   │   ├── deliveryService.ts     # Atomic deliveries with line items in transactions
│   │   ├── reportingService.ts    # Date boundary calculations & summary aggregations
│   │   ├── backupService.ts       # Versioned JSON export/import via Expo Sharing
│   │   ├── settingsService.ts     # Storage statistics & user preferences
│   │   └── testDataService.ts     # Explicit dev-only sample generator & DB reset
│   ├── app.json                   # WaterTrack Android package & config plugins
│   ├── eas.json                   # Standalone Android APK build profiles
│   └── package.json
│
├── backend/                       # Optional companion Python FastAPI service
│   ├── app/
│   │   ├── main.py                # FastAPI entry point with CORS & routes
│   │   ├── schemas.py             # Pydantic models matching TypeScript types
│   │   ├── services/
│   │   │   └── reporting.py       # Server-side reporting & business calculations
│   │   └── routers/
│   │       ├── health.py          # GET /health
│   │       ├── reports.py         # POST /reports/summary, /customer, /bottle-sizes
│   │       └── backup.py          # POST /backup/validate
│   ├── tests/
│   │   ├── test_api.py            # API endpoint integration tests
│   │   └── test_reporting.py      # Calculations unit tests
│   └── requirements.txt
│
└── README.md
```

---

## 📱 Features

### 1. Dashboard
- Clean, professional light theme by default (dark mode toggle available).
- Live metrics computed from real SQLite records:
  - Today's total bottles delivered.
  - Today's completed delivery shipments.
  - Unique customers served today.
  - Total bottles delivered this week.
  - Total bottles delivered this month.
- Today's bottle size breakdown (e.g. 20L jars, 2L, 1L, 500ml).
- Prominent action buttons: **+ Add Delivery**, **+ Add Customer**, **View Today's Deliveries**, and **View Reports**.
- Recent deliveries section showing customer, location, time, and quantities.
- Proper empty states when no records exist.

### 2. Customer Management
- Register businesses with customer type (`Hotel`, `Shop`, `Office`, `Other`), phone, delivery address, and notes.
- Automatic **duplicate warning** for similar customer names or matching phone numbers.
- Filter customer list by type, search by name/address/phone, and sort alphabetically (A-Z) or by recent delivery.
- Customer details screen with total deliveries, all-time bottle counts, bottle-size breakdown, and complete shipment history.
- **Safe Archival Strategy**: Customers with delivery history are protected from accidental hard deletion and safely archived to prevent breaking past delivery snapshots.

### 3. Add Delivery Wizard
- **Step 1: Select Customer** with instant search and "+ Add New Customer" shortcut.
- **Step 2: Enter Delivery Quantities** with large touch-friendly `[-]` and `[+]` steppers or direct number input across all active bottle sizes. Total bottle counter updates in real time.
- **Step 3: Delivery Information** defaulting to today's date, current time, and customer's saved address. Backdated deliveries supported.
- **Step 4: Review and Save** with double-tap submission prevention and atomic SQLite transaction.

### 4. Deliveries History
- Filter deliveries by date (presets or custom date range) and customer type.
- Sort newest first or oldest first.
- Full itemized bottle breakdown on every card.
- Open delivery details, edit delivery, or delete with confirmation.
- Atomic line-item updates in SQLite transactions.

### 5. Interactive Calendar & Date Filtering
- Quick presets: **Today**, **Yesterday**, **This Week**, **Last Week**, **This Month**, **Last Month**, and **Custom Date Range**.
- Monday-first interactive calendar with month/year navigation, range highlighting, and validation (end date cannot precede start date).
- Consistent local day calculation (`YYYY-MM-DD`).

### 6. Reports & Analytics
- 4 real-time SVG charts computed from SQLite records:
  1. **Daily Distribution Bar Chart**
  2. **Bottle-Size Distribution Chart**
  3. **Top Customers by Quantity Chart**
  4. **Distribution Trend Chart**
- Sub-tabs for detailed breakdown tables: Overview, Bottle Sizes, Customers, and Daily logs.
- Strict consistency rule: sum of daily quantities equals total bottles.

### 7. Configurable Bottle Sizes & Settings
- Add, edit, activate, or deactivate bottle sizes in Settings.
- Configure name, volume (ml), and optional default prices.
- Safe deactivation if product was used in historical deliveries.
- Database & storage statistics (count of customers, deliveries, line items, and schema version).
- **Export Backup (JSON)**: Exports versioned backup using Expo Sharing.
- **Developer Tools**: Explicit dev-only buttons to seed 7-day sample records or reset the database.

---

## 🚀 Running the Mobile Application

### Prerequisites
- Node.js (v18+)
- npm

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start the Development Server
```bash
npx expo start
```

- Press `a` to open in Android Emulator (or connect an Android device via USB with USB Debugging enabled).
- Scan the QR code using the **Expo Go** app on your physical Android device.

### 3. Type Checking
```bash
cd mobile
npx tsc --noEmit
```
*(Verified: 0 errors across entire mobile project)*

---

## 📦 Building an Installable Android APK

WaterTrack is configured for standalone APK generation using **Expo EAS Build**.

### 1. Install EAS CLI (if not already installed)
```bash
npm install -g eas-cli
```

### 2. Login to your Expo account
```bash
eas login
```

### 3. Build the Standalone Android APK
Run the preview build profile (configured in `eas.json` with `buildType: "apk"`):
```bash
cd mobile
eas build --platform android --profile preview
```

Or for a production APK:
```bash
eas build --platform android --profile production
```

When the build completes, EAS will provide a direct download URL for the `.apk` file. Transfer it to your Android device or download directly to install.

### Local APK Build (Alternative with Android SDK)
If you have Android Studio / Android SDK installed locally:
```bash
cd mobile
npx expo run:android --variant release
```

---

## 🐍 Running the Companion Python FastAPI Backend

The backend provides an optional server for central report calculation, validation, and backup inspection. The mobile app works 100% offline without it.

### Prerequisites
- Python 3.10+

### 1. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the FastAPI Server
```bash
uvicorn backend.app.main:app --reload --port 8000
```

- **Interactive API Documentation (Swagger)**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### 3. Run Backend Pytest Suite
```bash
python -m pytest backend/tests
```
*(Verified: 5/5 tests passing)*

---

## 🗄️ SQLite Database Schema

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'Other',
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bottle_sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  volume_ml INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  default_unit_price REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  delivery_date TEXT NOT NULL,
  delivered_at TEXT NOT NULL,
  delivery_location TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE delivery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  bottle_size_id INTEGER NOT NULL REFERENCES bottle_sizes(id),
  bottle_size_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_snapshot REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

---

## ✅ Acceptance Criteria & Test Results

| # | Test Criteria | Implementation & Status |
|---|---|---|
| **Test 1** | Customer registration & persistence | Implemented in `customerService.ts` via SQLite. Survives app restarts. |
| **Test 2** | Multiple bottle sizes in one delivery | Implemented in `new.tsx` & `deliveryService.ts`. Sum of line items derives totals. |
| **Test 3** | Multiple customers & separate histories | Each customer has dedicated delivery history in `customer/[id].tsx`. |
| **Test 4** | Today's report derived from SQLite | Dynamic queries in `reportingService.ts` filter by local today date. |
| **Test 5** | Weekly report boundary (Monday-first) | Monday-to-Sunday window calculation in `getThisWeekRange`. |
| **Test 6** | Monthly report & leap year boundaries | Accurate date math via `new Date(year, month + 1, 0)`. |
| **Test 7** | Custom date range inclusive | Filter query `delivery_date >= ? AND delivery_date <= ?` with validation. |
| **Test 8** | Immediate UI updates on edit | Handled via SQLite transactions and `useFocusEffect` hooks on all screens. |
| **Test 9** | Delivery deletion updates totals | Cascading delete in SQLite transaction removes line items and updates reports. |
| **Test 10** | Offline operation (Airplane mode) | Fully local SQLite engine (`expo-sqlite`); zero external API blockers. |
| **Test 11** | Clean empty states | `EmptyState` component rendered when tables contain 0 records. |
| **Test 12** | APK Build Configuration | `eas.json` with `preview` and `production` APK build profiles and `app.json`. |
| **Test 13** | Backup export & recovery | JSON export via `expo-file-system/legacy` & `expo-sharing` with validation. |
| **Test 14** | Data consistency | Sum of line items strictly equals total bottles everywhere across app. |

# WaterTracker
