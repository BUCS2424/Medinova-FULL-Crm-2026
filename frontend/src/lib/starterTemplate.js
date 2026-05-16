export const STARTER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{page_title}}</title>
<meta name="description" content="{{meta_description}}" />
<link rel="canonical" href="{{canonical_url}}" />
<style>
:root {
  --primary: #0055CC;
  --primary-light: #e8f0fe;
  --fg: #0b1120;
  --bg: #ffffff;
  --border: #d0dcf0;
  font-family: 'Figtree', 'Inter', system-ui, sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--fg);line-height:1.6;}
.hero{background:var(--primary);color:#fff;padding:80px 24px;text-align:center;}
.hero h1{font-size:clamp(2rem,5vw,3.25rem);font-weight:800;line-height:1.2;margin-bottom:16px;}
.hero p{font-size:1.2rem;opacity:0.9;max-width:600px;margin:0 auto 32px;}
.btn{display:inline-block;background:#fff;color:var(--primary);padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:1rem;}
.btn:hover{opacity:0.9;}
.container{max-width:1100px;margin:0 auto;padding:0 24px;}
.section{padding:72px 24px;}
.section h2{font-size:2rem;font-weight:700;margin-bottom:16px;color:var(--primary);}
.section p{max-width:720px;line-height:1.8;color:#444;}
.cta-section{background:var(--primary-light);padding:64px 24px;text-align:center;}
.cta-section h2{font-size:2rem;font-weight:700;color:var(--primary);margin-bottom:12px;}
.cta-section p{color:#555;margin-bottom:28px;}
.cta-btn{background:var(--primary);color:#fff;padding:14px 40px;border-radius:8px;font-weight:700;text-decoration:none;font-size:1rem;}
.cta-btn:hover{opacity:0.88;}
.faq{padding:64px 24px;max-width:800px;margin:0 auto;}
.faq h2{font-size:2rem;font-weight:700;margin-bottom:32px;}
details{border:1px solid var(--border);border-radius:8px;margin-bottom:12px;padding:16px 20px;}
summary{font-weight:600;cursor:pointer;list-style:none;}
summary::-webkit-details-marker{display:none;}
details p{margin-top:10px;color:#555;line-height:1.7;}
</style>
</head>
<body>

<section class="hero">
  <div class="container">
    <h1>{{hero_headline}}</h1>
    <p>{{hero_sub}}</p>
    <a href="__GET_STARTED_URL__" class="btn">{{cta_text}}</a>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2>{{h2_intro}}</h2>
    <p>{{p_intro}}</p>
  </div>
</section>

<section class="cta-section">
  <div class="container">
    <h2>{{cta_headline}}</h2>
    <p>{{cta_subline}}</p>
    <a href="__GET_STARTED_URL__" class="cta-btn">{{cta_text}}</a>
  </div>
</section>

<section class="faq">
  <h2>Frequently Asked Questions</h2>
  {{faq_block}}
</section>

</body>
</html>`;
