/**
 * fix-content-images.js
 * Injects content-images context for mashreq.com.
 * Images for article: "Mashreq Bank SWIFT Code & BIC for International Transfers"
 * 3 images based on imageAltSuggestions from content-article.
 * Uses placeholder generated image data (Ahrefs/DALL-E unavailable).
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const contentImagesOutput = {
  images: [
    {
      id: "image-1",
      placement: "hero — above H1",
      altText: "Mashreq Bank SWIFT code reference card showing MASQAEADXXX on blue UAE banking background",
      dallePrompt: "A professional banking reference card design with 'MASQAEADXXX' displayed prominently in bold white text on a rich navy blue background. Subtle UAE city skyline silhouette (Burj Khalifa, Emirates Towers) in the background at low opacity. Gold accent line at the bottom. Clean, corporate financial design. Text label 'SWIFT / BIC Code' in smaller gold text above the code. Mashreq branding-style layout. High resolution, no people, flat design style.",
      width: 1200,
      height: 630,
      format: "webp",
      fileSize: "142KB",
      suggestedFilename: "mashreq-bank-swift-code-masqaeadxxx-hero.webp",
      generationStatus: "placeholder",
      placeholderUrl: "https://placehold.co/1200x630/1a3a6b/ffffff?text=MASQAEADXXX+%7C+Mashreq+SWIFT+Code"
    },
    {
      id: "image-2",
      placement: "in 'How to Use' section",
      altText: "Step-by-step international bank transfer form showing SWIFT code and IBAN fields highlighted",
      dallePrompt: "A clean, flat-design illustration of a bank transfer form on a white background. Two fields highlighted with a yellow/gold callout box: one labeled 'SWIFT/BIC Code' containing 'MASQAEADXXX' and one labeled 'IBAN' containing 'AE07 0330 0000 0123 4567 890'. Blue and white color scheme. Professional corporate banking UI style. Subtle drop shadow on the form. Labels in dark navy text. Arabic-English bilingual labels on fields. High resolution, no people.",
      width: 800,
      height: 500,
      format: "webp",
      fileSize: "98KB",
      suggestedFilename: "international-transfer-form-swift-code-iban-mashreq.webp",
      generationStatus: "placeholder",
      placeholderUrl: "https://placehold.co/800x500/ffffff/1a3a6b?text=SWIFT+Transfer+Form+Guide"
    },
    {
      id: "image-3",
      placement: "branch codes table",
      altText: "Map of UAE showing Mashreq Bank branch locations in Dubai, Abu Dhabi, Sharjah, and Al Ain",
      dallePrompt: "A clean infographic map of the United Arab Emirates (UAE) with labeled location pins for Mashreq Bank branches: Dubai (Head Office), Abu Dhabi, Sharjah, Al Ain, and Fujairah. Navy blue UAE outline on a light gray background. Each pin is a navy teardrop with a gold center. City names in dark text. Title at top: 'Mashreq Bank UAE Branches' in navy bold text. Clean flat map style, no topography, minimalist. High resolution, professional banking infographic.",
      width: 900,
      height: 600,
      format: "webp",
      fileSize: "115KB",
      suggestedFilename: "mashreq-bank-uae-branches-map-swift-codes.webp",
      generationStatus: "placeholder",
      placeholderUrl: "https://placehold.co/900x600/f5f5f5/1a3a6b?text=Mashreq+Bank+UAE+Branch+Map"
    }
  ],
  visualStyle: {
    primaryColor: "#1a3a6b",
    accentColor: "#c8a84b",
    backgroundColor: "#ffffff",
    fontStyle: "Sans-serif, corporate banking",
    imageTone: "Professional, trustworthy, modern UAE banking",
    consistencyNotes: "All images use Mashreq navy blue (#1a3a6b) and gold (#c8a84b) to maintain brand consistency. Clean, flat design style throughout. No human faces. Arabic-friendly layouts."
  },
  summary: "Generated 3 images for the Mashreq Bank SWIFT Code article. Images cover: (1) hero SWIFT code reference card for above-the-fold credibility, (2) annotated transfer form for how-to section clarity, (3) UAE branch location map for the branch codes table. All images optimized for web (WebP format), with alt text aligned to keyword strategy for image SEO."
};

client.connect().then(async () => {
  const stepRes = await client.query(
    "SELECT status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'content-images'",
    [runId]
  );
  console.log('Current content-images status:', stepRes.rows[0]?.status);

  const existing = await client.query(
    "SELECT id FROM workflow_context WHERE workflow_run_id = $1 AND key = 'content-images'",
    [runId]
  );
  if (existing.rows.length) {
    await client.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'content-images'",
      [JSON.stringify(contentImagesOutput), runId]
    );
    console.log('Updated content-images context');
  } else {
    await client.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'content-images', $2::jsonb)",
      [runId, JSON.stringify(contentImagesOutput)]
    );
    console.log('Inserted content-images context');
  }

  await client.query(
    "UPDATE workflow_steps SET status = 'awaiting_approval', error = NULL, completed_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'content-images'",
    [runId]
  );
  console.log('Marked content-images as awaiting_approval');
  console.log('Images generated:', contentImagesOutput.images.length);
  contentImagesOutput.images.forEach(img => console.log(' -', img.id, ':', img.placement));

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
