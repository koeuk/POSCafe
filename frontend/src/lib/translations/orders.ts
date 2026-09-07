/** Khmer for the Orders queue and order history. */
export const orders = {
  // Orders queue (app/(staff)/orders/page.tsx)
  "{count} active · {total} total": "កំពុងដំណើរការ {count} · សរុប {total}",
  "{count} {status}": "{status} {count}",
  "Live": "ផ្សាយផ្ទាល់",
  "Offline": "ក្រៅបណ្តាញ",
  "Filter orders by status": "ត្រងការបញ្ជាទិញតាមស្ថានភាព",
  "Loading orders…": "កំពុងផ្ទុកការបញ្ជាទិញ…",
  "No orders here yet.": "មិនទាន់មានការបញ្ជាទិញនៅទីនេះទេ។",
  "Failed to load orders": "បរាជ័យក្នុងការផ្ទុកការបញ្ជាទិញ",
  "Failed to update status": "បរាជ័យក្នុងការកែប្រែស្ថានភាព",
  "Start preparing": "ចាប់ផ្តើមរៀបចំ",
  "Mark ready": "សម្គាល់ថារួចរាល់",
  "Complete": "បញ្ចប់",
  // Order history (components/order-history-view.tsx)
  "1 order": "ការបញ្ជាទិញ 1",
  "${amount} paid revenue": "ចំណូលបានបង់ប្រាក់ ${amount}",
  "Failed to refund order": "បរាជ័យក្នុងការបង្វិលប្រាក់ការបញ្ជាទិញ",
  "Refund": "បង្វិលប្រាក់",
  "Receipt": "វិក្កយបត្រ",
  "Refund {order}?": "បង្វិលប្រាក់ {order}?",
  "This returns ${amount} to the customer, cancels the order and restocks its items. This cannot be undone.":
    "ការនេះនឹងប្រគល់ ${amount} ទៅអតិថិជនវិញ លុបចោលការបញ្ជាទិញ និងបញ្ចូលទំនិញត្រឡប់ចូលស្តុកវិញ។ មិនអាចត្រឡប់វិញបានទេ។",
  "Refunding…": "កំពុងបង្វិលប្រាក់…",
  "Refund order": "បង្វិលប្រាក់ការបញ្ជាទិញ",
  // Status tabs (components/status-tabs.tsx)
  "Filter": "ត្រង",
  // No access (app/(staff)/no-access/page.tsx)
  "No pages assigned": "មិនទាន់មានទំព័រណាត្រូវបានផ្តល់ឱ្យទេ",
  "Hi {name} — your account doesn't have access to any pages yet. Ask an admin to grant you access from Settings → Staff.":
    "សួស្តី {name} — គណនីរបស់អ្នកមិនទាន់មានសិទ្ធិចូលទំព័រណាមួយទេ។ សូមស្នើអ្នកគ្រប់គ្រងឱ្យផ្តល់សិទ្ធិពី ការកំណត់ → បុគ្គលិក។",
  "Your account doesn't have access to any pages yet. Ask an admin to grant you access from Settings → Staff.":
    "គណនីរបស់អ្នកមិនទាន់មានសិទ្ធិចូលទំព័រណាមួយទេ។ សូមស្នើអ្នកគ្រប់គ្រងឱ្យផ្តល់សិទ្ធិពី ការកំណត់ → បុគ្គលិក។",
  "Sign out": "ចាកចេញ",
  // Guards (components/page-guard.tsx)
  "Redirecting…": "កំពុងបញ្ជូនបន្ត…",
  // Theme toggle (components/theme-toggle.tsx)
  "Switch to light mode": "ប្តូរទៅរបៀបភ្លឺ",
  "Switch to dark mode": "ប្តូរទៅរបៀបងងឹត",
  "Light mode": "របៀបភ្លឺ",
  "Dark mode": "របៀបងងឹត",
  "Take payment first": "សូមទទួលការទូទាត់ជាមុនសិន",
} as const;
