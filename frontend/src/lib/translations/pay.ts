/** Khmer for the Payments page, payment QR and receipt. */
export const pay = {
  // Payments: pick an unpaid order
  "Take Payment": "ទទួលការទូទាត់",
  "Pick an unpaid order": "ជ្រើសរើសការបញ្ជាទិញដែលមិនទាន់បង់ប្រាក់",
  "No unpaid orders right now.": "ឥឡូវនេះគ្មានការបញ្ជាទិញដែលមិនទាន់បង់ប្រាក់ទេ។",
  "1 item": "ទំនិញ 1 មុខ",
  "Loading order…": "កំពុងផ្ទុកការបញ្ជាទិញ…",
  "All unpaid orders": "ការបញ្ជាទិញមិនទាន់បង់ប្រាក់ទាំងអស់",
  "This order has already been paid.": "ការបញ្ជាទិញនេះបានបង់ប្រាក់រួចហើយ។",
  // Payments: cash pad and confirm
  "Total due": "សរុបត្រូវបង់",
  "Cash received": "សាច់ប្រាក់ទទួលបាន",
  "Exact": "ចំនួនគត់",
  "{method} payment": "ការទូទាត់តាម{method}",
  "Confirm after the terminal transfer succeeds.": "បញ្ជាក់បន្ទាប់ពីការផ្ទេរតាមម៉ាស៊ីនកាតជោគជ័យ។",
  "Processing...": "កំពុងដំណើរការ...",
  "Confirm {method} payment · {amount}": "បញ្ជាក់ការទូទាត់តាម{method} · {amount}",
  "Payment failed": "ការទូទាត់បរាជ័យ",
  // Payments: success
  "Payment complete": "ការទូទាត់បានបញ្ចប់",
  "{method} paid {amount}": "បានបង់ {amount} តាម{method}",
  "Next payment": "ការទូទាត់បន្ទាប់",
  // Payments: dynamic KHQR panel
  "Could not build the QR code": "មិនអាចបង្កើតកូដ QR បានទេ",
  "QR payment isn't set up yet — add your Bakong account in Settings to show a scannable KHQR here. You can still confirm a transfer manually.":
    "ការទូទាត់តាម QR មិនទាន់បានរៀបចំទេ — បន្ថែមគណនី Bakong របស់អ្នកនៅក្នុងការកំណត់ ដើម្បីបង្ហាញ KHQR សម្រាប់ស្កេននៅទីនេះ។ អ្នកនៅតែអាចបញ្ជាក់ការផ្ទេរដោយដៃបាន។",
  "Generating QR…": "កំពុងបង្កើត QR…",
  "KHQR code for this order": "កូដ KHQR សម្រាប់ការបញ្ជាទិញនេះ",
  "QR expired": "QR ផុតកំណត់",
  "Scan with any Cambodian banking app, then ask the customer to enter the amount above.":
    "ស្កេនជាមួយកម្មវិធីធនាគារកម្ពុជាណាមួយ រួចសុំឱ្យអតិថិជនបញ្ចូលចំនួនទឹកប្រាក់ខាងលើ។",
  "Generate a new code to try again.": "បង្កើតកូដថ្មីដើម្បីព្យាយាមម្តងទៀត។",
  "Scan with any Cambodian banking app · expires in {time}":
    "ស្កេនជាមួយកម្មវិធីធនាគារកម្ពុជាណាមួយ · ផុតកំណត់ក្នុង {time}",
  "New QR code": "កូដ QR ថ្មី",
  // Payment QR poster (components/payment-qr.tsx)
  "Payment QR (KHQR)": "QR ទូទាត់ (KHQR)",
  "Print this and stand it on the counter — customers scan and enter the amount themselves.":
    "បោះពុម្ពនេះ ហើយដាក់នៅលើតុគិតលុយ — អតិថិជនស្កេន ហើយបញ្ចូលចំនួនទឹកប្រាក់ដោយខ្លួនឯង។",
  "Preparing…": "កំពុងរៀបចំ…",
  "Download PNG": "ទាញយក PNG",
  "Print poster": "បោះពុម្ពផ្ទាំងរូបភាព",
  "Generating…": "កំពុងបង្កើត…",
  "QR payment isn't set up yet — add your Bakong account in Settings to generate a payment QR.":
    "ការទូទាត់តាម QR មិនទាន់បានរៀបចំទេ — បន្ថែមគណនី Bakong របស់អ្នកនៅក្នុងការកំណត់ ដើម្បីបង្កើត QR ទូទាត់។",
  "Scan to pay · KHQR": "ស្កេនដើម្បីបង់ប្រាក់ · KHQR",
  "Shop payment QR code": "កូដ QR ទូទាត់របស់ហាង",
  "Scan with any Cambodian banking app, then enter the amount.":
    "ស្កេនជាមួយកម្មវិធីធនាគារកម្ពុជាណាមួយ រួចបញ្ចូលចំនួនទឹកប្រាក់។",
  "This code carries no amount and never expires. For a code with the amount already filled in, use the QR tab on the Payments screen.":
    "កូដនេះមិនមានចំនួនទឹកប្រាក់ និងមិនផុតកំណត់ឡើយ។ សម្រាប់កូដដែលមានចំនួនទឹកប្រាក់រួចស្រេច សូមប្រើផ្ទាំង QR នៅលើអេក្រង់ការទូទាត់។",
  // Receipt (app/receipt/page.tsx)
  "No order selected.": "មិនបានជ្រើសរើសការបញ្ជាទិញទេ។",
  "Failed to load order": "បរាជ័យក្នុងការផ្ទុកការបញ្ជាទិញ",
  "Order not found.": "រកមិនឃើញការបញ្ជាទិញទេ។",
  "Print": "បោះពុម្ព",
  "Thank you, see you again!": "សូមអរគុណ ជួបគ្នាម្តងទៀត!",
  // Order status dropdown (components/status-dropdown.tsx)
  "Order status": "ស្ថានភាពការបញ្ជាទិញ",
  // Money handed back to the customer (kept here so the meaning is clear).
  "Change": "ប្រាក់អាប់",
} as const;
