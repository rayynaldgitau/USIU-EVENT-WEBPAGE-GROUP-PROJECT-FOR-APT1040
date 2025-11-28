const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");


admin.initializeApp();
const db = admin.firestore();
// ---------------------------------------------------------------------
// TEMP: Sandbox credentials for demo only
// DO NOT do this in a real production project or a public repo.
// ---------------------------------------------------------------------
const MPESA_CONSUMER_KEY = "yjjUu7QQ30u9a2j1V5oQSGE7JJ2eFAqzYij1yJohQQGT0URN";
const MPESA_CONSUMER_SECRET = "DksoweNheQ3mRfIjmrdqvdsljXp52rrk8oGx5NKVLjoxNZyAnQucgn0iqcJakhxr";
const MPESA_SHORTCODE = "174379"; 
const MPESA_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";   // long string from Daraja

// Sandbox vs production (keep sandbox for now)
const MPESA_ENV = "sandbox";

const baseUrl =
  MPESA_ENV === "sandbox"
    ? "https://sandbox.safaricom.co.ke":
    // : "https://api.safaricom.co.ke";

// ---------------- Helper: get OAuth access token ----------------
async function getAccessToken() {
  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return res.data.access_token;
}

// ---------------- HTTPS Function: STK Push ----------------
exports.mpesaStkPush = functions.https.onRequest(async (req, res) => {
  // CORS – allow your GitHub Pages origin
  const allowedOrigins = [
    "https://rayynaldgitau.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { phone, amount, accountReference, description } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "Missing phone or amount" });
    }

    // Timestamp YYYYMMDDHHMMSS
    const now = new Date();
    const pad = (n) => (n < 10 ? "0" + n : n);
    const timestamp =
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());

    // Password = Base64(shortcode + passkey + timestamp)
    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    // Get OAuth token
    const token = await getAccessToken();

    // Call Daraja STK Push API
    const stkRes = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Number(amount),
        PartyA: phone, // 2547xxxxxxxx
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL:
          "https://us-central1-usiueventswebpagebackend.cloudfunctions.net/mpesaCallback",
        AccountReference: accountReference || "USIU Event",
        TransactionDesc: description || "USIU Event Ticket",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      data: {
        MerchantRequestID: stkRes.data.MerchantRequestID,
        CheckoutRequestID: stkRes.data.CheckoutRequestID,
        ResponseCode: stkRes.data.ResponseCode,
        ResponseDescription: stkRes.data.ResponseDescription,
        CustomerMessage: stkRes.data.CustomerMessage,
      },
    });
  } catch (err) {
    console.error("M-Pesa STK error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: "Failed to start M-Pesa payment",
      details: err.response?.data || err.message,
    });
  }
});

// ---------------- Helper: extract callback metadata ----------------
function extractCallbackMetadata(stkCallback) {
  const result = {};
  const items = stkCallback.CallbackMetadata?.Item || [];
  for (const item of items) {
    result[item.Name] = item.Value;
  }
  return result;
}

// ---------------- HTTPS Function: Callback handler ----------------
exports.mpesaCallback = functions.https.onRequest(async (req, res) => {
  try {
    const body = req.body;
    console.log("M-Pesa callback received:", JSON.stringify(body));

    if (!body || !body.Body || !body.Body.stkCallback) {
      console.error("Invalid callback body");
      // Respond 400 but still end politely
      res.status(400).send("Invalid callback format");
      return;
    }

    const cb = body.Body.stkCallback;
    const checkoutRequestId = cb.CheckoutRequestID;
    const resultCode = cb.ResultCode;
    const resultDesc = cb.ResultDesc;
    const metadata = extractCallbackMetadata(cb);

    console.log("Parsed callback:", {
      checkoutRequestId,
      resultCode,
      resultDesc,
      metadata,
    });

    // Find the registration in Firestore using CheckoutRequestID
    const snap = await db
      .collection("eventRegistrations")
      .where("checkoutRequestId", "==", checkoutRequestId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn(
        "No registration found for CheckoutRequestID:",
        checkoutRequestId
      );

      // Safaricom still expects a 200 OK to stop retrying
      res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Callback received (no matching record)",
      });
      return;
    }

    const docRef = snap.docs[0].ref;

    const updateData = {
      mpesaResultCode: resultCode,
      mpesaResultDesc: resultDesc,
      mpesaCallbackAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (resultCode === 0) {
      // Successful payment
      updateData.paymentStatus = "paid";
      updateData.mpesaReceiptNumber = metadata.MpesaReceiptNumber || null;
      updateData.mpesaAmount = metadata.Amount || null;
      updateData.mpesaPhone = metadata.PhoneNumber || null;
      updateData.mpesaTransactionDate = metadata.TransactionDate || null;
    } else {
      // Failed or cancelled
      updateData.paymentStatus = "failed";
    }

    await docRef.update(updateData);

    // Safaricom expects this format if happy
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Callback received successfully",
    });
  } catch (err) {
    console.error("Error handling M-Pesa callback:", err);
    // Still respond 200; just indicate error in description
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: "Callback processing error",
    });
  }
});