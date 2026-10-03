/**
 * Brochure kit — the stylesheet. One file, assembled from parts so each concern reads on its own:
 * base + typography · cover · at a glance · day spread + timeline rail · place cards · later · practical ·
 * attribution · screen layout · print fallback (browser print without the paginator) · paged mode (sheets the
 * PDF step builds). Units: rem on screen; the paged mode fixes the root size so rem maps to print points.
 */
import { tokensCss, pageSpec } from './tokens.mjs';
import { STACK } from './fonts.mjs';

export function stylesheet({ page = pageSpec(), fontCss = '', c11 = false } = {}) {
  // C11 (Phase 11) rules are added only when the model uses those fields, so an older brochure's HTML is unchanged.
  return [fontCss, tokensCss(page), BASE, COVER, GLANCE, DAY, RAIL, CARDS, LATER, PRACTICAL, ATTRIBUTION, ...(c11 ? [C11] : []), SCREEN, printFallback(page), PAGED].join('\n');
}

const BASE = `
*,*::before,*::after{box-sizing:border-box}
html{font-size:16px;-webkit-text-size-adjust:100%}
body{margin:0;font-family:${STACK};font-size:1rem;line-height:1.45;color:var(--ink);background:var(--paper);font-kerning:normal;font-variant-ligatures:common-ligatures;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4,p,ul,ol,figure{margin:0}
ul,ol{padding:0;list-style:none}
a{color:inherit;text-decoration:none}
a[href]{border-bottom:1px solid var(--rule)}
a[href]:hover{border-bottom-color:var(--accent)}
img,svg{display:block;max-width:100%}
.ic{display:inline-block;vertical-align:-0.18em;width:1em;height:1em}
.eyebrow{font-size:var(--s-2);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:400}
.eyebrow b{color:var(--accent);font-weight:400}
.lede{font-size:var(--s1);line-height:1.4;color:var(--ink2)}
.muted{color:var(--muted)}
.small{font-size:var(--s-1)}
.tiny{font-size:var(--s-2)}
.num{font-variant-numeric:tabular-nums}
.sec-head{display:grid;grid-template-columns:1fr auto;align-items:end;gap:1rem;border-bottom:1px solid var(--ink);padding-bottom:.5rem;margin-bottom:1.4rem}
.sec-head h2{font-size:var(--s5);font-weight:400;letter-spacing:-.015em;line-height:1}
.sec-head .eyebrow{margin-bottom:.45rem}
.orn{margin:0 auto}
.chip{display:inline-block;font-size:var(--s-2);letter-spacing:.08em;text-transform:uppercase;padding:.12em .5em .1em;border:1px solid var(--rule);border-radius:2px;color:var(--ink2);white-space:nowrap}
.chip.hue{border-color:var(--hue,var(--accent));color:var(--hue,var(--accent))}
.badge{display:inline-flex;align-items:center;justify-content:center;width:1.55em;height:1.55em;border-radius:50%;background:var(--hue,var(--accent));color:#fff;font-weight:700;font-size:var(--s-1);line-height:1}
.badge.meal{background:#fff;color:var(--hue,var(--accent));border:1.5px solid var(--hue,var(--accent))}
.stars{display:inline-flex;gap:1px;color:var(--ochre);vertical-align:-.1em}
.legend{display:flex;flex-wrap:wrap;gap:.3rem .9rem;font-size:var(--s-2);color:var(--muted);font-style:italic}
.legend-item{display:inline-flex;align-items:center;gap:.35rem}
.warnings{display:grid;gap:.45rem}
.warning{display:grid;grid-template-columns:1.1rem 1fr;gap:.45rem;font-size:var(--s-1);line-height:1.35;padding:.5rem .6rem;border-left:2px solid var(--warn);background:#fbf6ea}
.warning .ic{color:var(--warn);margin-top:.1em}
.warning.alert{border-left-color:var(--alert);background:#f9ecea}.warning.alert .ic{color:var(--alert)}
.warning.info{border-left-color:var(--sea);background:var(--sea-soft)}.warning.info .ic{color:var(--sea)}
`;
const COVER = `
.sec-cover{position:relative;overflow:hidden;background:var(--cream);color:var(--ink);display:flex;flex-direction:column;justify-content:flex-end;min-height:100vh;padding:var(--m-top) var(--m-right) var(--m-bottom) var(--m-left)}
.cover-art{position:absolute;inset:0;z-index:0}
.cover-art svg{width:100%;height:100%}
.cover-text{position:relative;z-index:1;max-width:34rem}
.cover-text .eyebrow{margin-bottom:1.1rem}
.cover-title{font-size:var(--s8);font-weight:400;line-height:.98;letter-spacing:-.022em;text-wrap:balance;margin-bottom:.35rem}
.cover-sub{font-size:var(--s4);font-style:italic;color:var(--accent);line-height:1.1;letter-spacing:-.01em;margin-bottom:1.6rem}
.cover-facts{display:flex;flex-wrap:wrap;gap:0 2.2rem;border-top:1px solid var(--ink);padding-top:.7rem;margin:0}
.cover-facts div{display:flex;flex-direction:column;gap:.15rem;padding:.1rem 0}
.cover-facts dt{font-size:var(--s-2);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.cover-facts dd{margin:0;font-size:var(--s0)}
.cover-foot{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;margin-top:1.8rem;font-size:var(--s-2);color:var(--muted);letter-spacing:.06em}
.cover-foot .compass{opacity:.7}
.cover-days{position:absolute;z-index:1;top:var(--m-top);right:var(--m-right);text-align:right;font-size:var(--s-1);line-height:1.5;color:var(--ink2)}
.cover-days b{display:block;font-size:var(--s3);font-weight:400;letter-spacing:-.01em;color:var(--ink);line-height:1.05}
`;
const GLANCE = `
.sec-meta{font-size:var(--s-1);color:var(--muted);font-style:italic;text-align:right}
.intro{columns:2;column-gap:2rem;margin-bottom:1.6rem;font-size:var(--s0);line-height:1.5}
.intro p{margin-bottom:.6rem;break-inside:avoid}
.intro p:first-child::first-letter{font-size:3.1em;float:left;line-height:.8;padding:.08em .08em 0 0;color:var(--accent)}
.glance-days{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:0 1.4rem;border-top:1px solid var(--ink);margin-bottom:1.6rem}
.gday{padding:.8rem 0 .9rem;border-top:3px solid var(--hue);margin-top:-1px}
.gday-head{display:flex;align-items:baseline;gap:.55rem;margin-bottom:.3rem}
.gday-n{font-size:var(--s5);line-height:1;letter-spacing:-.02em;color:var(--hue);font-variant-numeric:tabular-nums}
.gday-date{font-size:var(--s0)}
.gday-theme{font-style:italic;font-size:var(--s1);line-height:1.2;margin:.1rem 0 .6rem;color:var(--ink)}
.gday-stops li{display:grid;grid-template-columns:1.1rem 1fr auto;gap:.4rem;align-items:baseline;font-size:var(--s-1);line-height:1.3;padding:.22rem 0;border-top:1px solid var(--hair)}
.gday-stops .n{color:var(--hue);font-weight:700;font-size:var(--s-2)}
.gday-stops .t{color:var(--muted);font-size:var(--s-2);font-variant-numeric:tabular-nums}
.gday-stops li.ismeal .n{font-weight:400}
.gday-foot{font-size:var(--s-2);color:var(--muted);margin-top:.55rem;line-height:1.4;border-top:1px solid var(--hair);padding-top:.4rem}
.glance-map{display:grid;grid-template-columns:1.25fr 1fr;gap:1.6rem;align-items:start}
.glance-map .sketch{width:100%;height:auto}
.glance-keys{display:grid;gap:.9rem;font-size:var(--s-1);line-height:1.4}
.glance-keys .eyebrow{margin-bottom:.25rem}
.keyline{display:flex;gap:.55rem;align-items:baseline}
.keyline .swatch{display:inline-block;width:.75rem;height:.75rem;border-radius:50%;background:var(--hue);flex:none;transform:translateY(.1em)}
`;
const DAY = `
.day-head{display:grid;grid-template-columns:auto 1fr auto;gap:1.2rem;align-items:start;border-bottom:1px solid var(--ink);padding-bottom:.9rem;margin-bottom:1.1rem}
.day-n{font-size:var(--s9);line-height:.82;letter-spacing:-.04em;color:var(--hue);font-variant-numeric:tabular-nums;margin-top:.06em}
.day-titles h2{font-size:var(--s5);font-weight:400;font-style:italic;letter-spacing:-.015em;line-height:1.02;margin:.2rem 0 .45rem;text-wrap:balance}
.day-summary{font-size:var(--s-1);line-height:1.4;color:var(--ink2);max-width:30rem}
.day-stats{display:grid;grid-template-columns:auto auto;gap:.12rem .7rem;font-size:var(--s-2);line-height:1.35;align-self:end;padding-left:1rem;border-left:1px solid var(--rule);min-width:9rem}
.day-stats dt{color:var(--muted);letter-spacing:.1em;text-transform:uppercase;font-size:var(--s-3)}
.day-stats dd{margin:0;font-variant-numeric:tabular-nums;text-align:right}
.day-aside{display:grid;gap:.9rem;align-content:start}
.sketch-fig .sketch{width:100%;height:auto}
.gmap{position:relative;border:1px solid #e2dbcf;border-radius:3px;overflow:hidden;background:#f6f1e7}
.gmap img{display:block;width:100%;height:100%;object-fit:cover}
.gmap-marks{position:absolute;inset:0;width:100%;height:100%}
.map-fig{margin:0}
.map-fig figcaption{margin-top:.4rem}
.glance-map .gmap{width:100%}
.sketch-fig figcaption{margin-top:.4rem}
.aside-block{font-size:var(--s-1);line-height:1.4}
.aside-block .eyebrow{margin-bottom:.2rem}
.aside-block .ic{color:var(--muted);margin-right:.25rem}
.verified{color:var(--faint);font-style:italic}
`;
const RAIL = `
.rail{--tcol:3.9rem;--mcol:1.7rem}
.ti{position:relative;display:grid;grid-template-columns:var(--tcol) var(--mcol) minmax(0,1fr);column-gap:.5rem;padding:.5rem 0}
.ti::before{content:"";position:absolute;left:calc(var(--tcol) + .5rem + var(--mcol)/2 - .5px);top:0;bottom:0;width:1px;background:var(--rule)}
.ti:first-child::before{top:1rem}
.ti:last-child::before{bottom:auto;height:1rem}
.ti-time{text-align:right;line-height:1.15;padding-top:.15rem;font-variant-numeric:tabular-nums}
.ti-time .t{display:block;font-size:var(--s0)}
.ti-time .t small{font-size:.62em;letter-spacing:.04em;margin-left:.1em}
.ti-time .t2{display:block;color:var(--muted);font-size:var(--s-2);margin-top:.1rem;white-space:nowrap}
.ti-mark{position:relative;z-index:1;display:flex;justify-content:center;align-items:flex-start}
.ti-stop .ti-mark .badge{width:1.7rem;height:1.7rem;font-size:var(--s0);box-shadow:0 0 0 3px var(--paper)}
.ti-meal .ti-mark .badge{width:1.5rem;height:1.5rem;box-shadow:0 0 0 3px var(--paper);margin-top:.05rem}
.ti-meal .ti-mark .ic{width:.8rem;height:.8rem}
.ti-leg{padding:.15rem 0}
.ti-leg .ti-mark span{display:inline-flex;width:1.25rem;height:1.25rem;border-radius:50%;background:var(--paper);border:1px solid var(--rule);color:var(--ink2);align-items:center;justify-content:center}
.ti-leg .ti-mark .ic{width:.78rem;height:.78rem}
.ti-leg .ti-time .t{font-size:var(--s-2);color:var(--muted)}
.ti-leg .ti-body{font-size:var(--s-1);color:var(--ink2);padding-top:.1rem;line-height:1.35}
.ti-leg .ti-body b{font-weight:400;color:var(--ink)}
.ti-leg .ti-body a{color:var(--sea);border-bottom-color:var(--sea-soft);margin-left:.25rem}
.ti-leg .ti-body .line{display:block;color:var(--muted);font-size:var(--s-2);font-style:italic}
.ti-free{padding:.35rem 0}
.ti-free .ti-mark span{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;border:1px solid var(--faint);background:var(--paper);margin-top:.3rem}
.ti-free .ti-body{font-size:var(--s-1);font-style:italic;color:var(--muted);line-height:1.35;padding-top:.1rem}
.ti-free .ti-body b{font-style:normal;font-weight:400;color:var(--ink2)}
.ti-body{min-width:0}
.ti-name{font-size:var(--s2);line-height:1.12;letter-spacing:-.008em;margin-bottom:.1rem}
.ti-name .chip{margin-left:.4rem;vertical-align:.25em}
.ti-act{font-style:italic;color:var(--ink2);font-size:var(--s0);line-height:1.3}
.ti-meta{font-size:var(--s-2);color:var(--muted);margin-top:.22rem;line-height:1.45;letter-spacing:.01em}
.ti-meta .sep{margin:0 .35em;color:var(--faint)}
.ti-meta .closed{color:var(--alert)}
.ti-note{font-size:var(--s-1);line-height:1.38;margin-top:.3rem;color:var(--ink);max-width:28rem;padding-left:.6rem;border-left:2px solid var(--hue-soft)}
.ti-meal .ti-name{font-size:var(--s1)}
.ti-meal .ti-kind{color:var(--hue);font-style:italic}
`;
const CARDS = `
.cards{columns:2;column-gap:1.5rem}
.card{border-top:3px solid var(--hue);padding-top:.6rem;break-inside:avoid;margin-bottom:1.3rem}
.card-head{display:grid;grid-template-columns:auto 1fr;gap:.6rem;align-items:start;margin-bottom:.5rem}
.card-head .badge{width:1.6rem;height:1.6rem;font-size:var(--s-1);margin-top:.15rem}
.card-head h3{font-size:var(--s3);font-weight:400;line-height:1.08;letter-spacing:-.012em;margin:.12rem 0 .05rem;text-wrap:balance}
.card-tag{font-style:italic;color:var(--ink2);font-size:var(--s-1);line-height:1.3}
.card-meta{display:grid;gap:.15rem;font-size:var(--s-2);color:var(--ink2);line-height:1.4;margin:.4rem 0 .55rem;padding:.45rem 0;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}
.card-meta li{display:grid;grid-template-columns:1rem 1fr;gap:.35rem;align-items:baseline}
.card-meta .ic{color:var(--muted);transform:translateY(.1em)}
.card-meta .closed{color:var(--alert)}
.card-meta a{color:var(--sea);border-bottom-color:var(--sea-soft)}
.card-meta .stars{margin-right:.25rem}
.card-notes{display:grid;gap:.42rem;font-size:var(--s-1);line-height:1.4}
.cn{display:grid;grid-template-columns:4.6rem 1fr;gap:.5rem}
.cn h4{font-size:var(--s-3);letter-spacing:.14em;text-transform:uppercase;color:var(--hue);font-weight:400;padding-top:.28em;line-height:1.3}
.cn.why p{font-size:var(--s0);line-height:1.38}
.card-pair{margin-top:.5rem;color:var(--muted)}
.card-pair b{font-weight:400;color:var(--ink2)}
.card-src{margin-top:.35rem;color:var(--faint);line-height:1.35}
.card-src a{border-bottom-color:transparent}
.card-rev{margin-top:.5rem;padding:.5rem .65rem;background:var(--cream);font-size:var(--s-1);line-height:1.4}
.card-rev q{font-style:italic;quotes:"“" "”"}
.card-rev .by{display:block;margin-top:.2rem;font-size:var(--s-2);color:var(--muted);font-style:normal}
.card-rev .by a{color:var(--sea);border-bottom-color:var(--sea-soft)}
.card-day{font-size:var(--s-3);letter-spacing:.14em;text-transform:uppercase;color:var(--hue);margin-top:.2rem}
.card-fig{margin:0 0 .6rem}
.card-img{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;filter:saturate(.9)}
.card-img.gphoto{aspect-ratio:5/2}
.photo-credit{font-size:var(--s-2);color:var(--muted);font-style:italic;margin-top:.2rem;line-height:1.3}
.pref{color:var(--sea);border-bottom-color:var(--sea-soft);white-space:nowrap}
.card-edit{font-size:var(--s-1);color:var(--ink2);line-height:1.4;margin-bottom:.4rem}
.card-edit .tiny{color:var(--faint)}
`;
const LATER = `
.later-lists{columns:2;column-gap:1.6rem}
.later-list{break-inside:avoid;margin-bottom:1.4rem}
.later-list h3{font-size:var(--s2);font-weight:400;font-style:italic;letter-spacing:-.01em;line-height:1.1;margin-bottom:.15rem}
.later-list .desc{font-size:var(--s-1);color:var(--muted);line-height:1.35;margin-bottom:.45rem}
.later-list ul{border-top:1px solid var(--ink)}
.later-list li{padding:.5rem 0;border-bottom:1px solid var(--hair);display:grid;grid-template-columns:1fr;gap:.12rem}
.li-name{font-size:var(--s0);line-height:1.25}
.li-name .chip{margin-left:.4rem;vertical-align:.15em}
.li-reason{font-size:var(--s-1);color:var(--ink2);line-height:1.35;font-style:italic}
.li-note{font-size:var(--s-2);color:var(--muted);line-height:1.35}
.li-closed{color:var(--alert)}
`;
const PRACTICAL = `
.pblocks{columns:2;column-gap:1.6rem}
.pblock{border-top:1px solid var(--ink);padding-top:.5rem;break-inside:avoid;margin-bottom:1.2rem}
.pblock h3{font-size:var(--s2);font-weight:400;letter-spacing:-.01em;line-height:1.1;margin-bottom:.45rem}
.pblock p{font-size:var(--s-1);line-height:1.42;color:var(--ink);margin-bottom:.4rem}
.pblock dl{margin:0;display:grid;gap:.35rem}
.pblock dl div{display:grid;grid-template-columns:5.2rem 1fr;gap:.6rem;font-size:var(--s-1);line-height:1.38;border-top:1px solid var(--hair);padding-top:.35rem}
.pblock dt{color:var(--muted);font-size:var(--s-2);letter-spacing:.06em;text-transform:uppercase;padding-top:.15em}
.pblock dd{margin:0}
.pblock dd a{color:var(--sea);border-bottom-color:var(--sea-soft)}
.pblock li.plain{font-size:var(--s-1);line-height:1.38;border-top:1px solid var(--hair);padding:.3rem 0}
`;
const ATTRIBUTION = `
.sec-attr{font-size:var(--s-1);line-height:1.42}
.attr-google{display:grid;grid-template-columns:auto 1fr;gap:1.2rem;align-items:start;padding:.9rem 1rem;background:var(--cream);margin-bottom:1.2rem}
.gm-logo{padding-top:.15rem}
.gm-logo svg{width:7rem;height:auto}
.attr-google p{margin:0}
.attr-google p+p{margin-top:.3rem;color:var(--ink2)}
.attr h3{font-size:var(--s1);font-weight:400;font-style:italic;margin:1rem 0 .4rem}
.attr-reviews li{display:grid;grid-template-columns:1fr auto;gap:1rem;padding:.3rem 0;border-top:1px solid var(--hair);font-size:var(--s-1)}
.src-row{display:grid;grid-template-columns:minmax(0,1fr) 2.95in;gap:1rem;padding:.3rem 0;border-top:1px solid var(--hair);font-size:var(--s-1)}
.src-row .what{color:var(--muted);font-style:italic;text-align:right;line-height:1.35;padding-top:.1em}
.src-list a,.attr-reviews a{color:var(--sea);border-bottom-color:var(--sea-soft)}
.src-list .u{display:block;font-size:var(--s-2);color:var(--faint);word-break:break-all}
.src-list .place{color:var(--muted)}
.colophon{margin-top:1.6rem;padding-top:.7rem;border-top:1px solid var(--ink);display:flex;justify-content:space-between;gap:1rem;font-size:var(--s-2);color:var(--muted);line-height:1.45}
.colophon .orn{margin:0}
`;
/** Contract C11: the day's real start and bags, sourced visit facts, the dinner card, "This evening", the card's facts block, the season page. Existing tokens and components only. */
const C11 = `
.stale{color:var(--warn);font-style:italic}
.ti-meta .src{color:var(--faint);font-style:italic}
.ti-book .ic,.ti-crowd .ic,.ti-bags-line .ic{color:var(--hue)}
.ti-crowd{color:var(--ink2);font-style:italic}
.card-day .chip{margin-left:.5rem;font-size:var(--s-3);padding:.1em .45em .06em;vertical-align:.08em}
.ti-point .ti-mark .pt{display:inline-flex;width:1.5rem;height:1.5rem;border-radius:50%;background:var(--paper);border:1.5px solid var(--hue);color:var(--hue);align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--paper);margin-top:.05rem}
.ti-point .ti-mark .ic{width:.8rem;height:.8rem}
.ti-point .ti-name{font-size:var(--s1)}
.ti-point .ti-kind{color:var(--hue);font-style:italic}
.ti-point .ti-meta a,.ti-dine .ti-meta a,.ev-m a{color:var(--sea);border-bottom-color:var(--sea-soft)}
.dine-card{border:1px solid var(--hair);border-top:2px solid var(--hue);padding:.42rem .65rem .5rem}
.dine-card .ti-note{margin-top:.35rem}
.ti-evening .ti-mark span{display:inline-flex;width:1.35rem;height:1.35rem;border-radius:50%;background:var(--cream);border:1px solid var(--rule);color:var(--accent);align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--paper)}
.ti-evening .ti-mark .ic{width:.82rem;height:.82rem}
.ti-evening .ti-time .t2{letter-spacing:.1em;text-transform:uppercase;font-size:var(--s-3)}
.evening{background:var(--cream);border-left:2px solid var(--hue);padding:.5rem .75rem .55rem}
.evening .eyebrow{margin-bottom:.25rem}
.evening .eyebrow b{color:var(--ink);font-weight:400}
.ev-list li{display:grid;grid-template-columns:3.3rem .9rem minmax(0,1fr);gap:.4rem;align-items:baseline;padding:.3rem 0;border-top:1px solid var(--cream2);font-size:var(--s-1);line-height:1.35}
.ev-list li:first-child{border-top:0;padding-top:.1rem}
.ev-t{text-align:right;color:var(--ink2);font-variant-numeric:tabular-nums}
.ev-t small{font-size:.62em;letter-spacing:.04em;margin-left:.1em}
.ev-i .ic{width:.72rem;height:.72rem;color:var(--hue);transform:translateY(.08em)}
.ev-b .chip{margin-left:.4rem;vertical-align:.12em}
.ev-m{margin-left:.45rem;font-size:var(--s-2);color:var(--muted)}
.ev-m .sep{margin:0 .3em;color:var(--faint)}
.ev-n{display:block;font-size:var(--s-2);color:var(--ink2);font-style:italic;margin-top:.05rem}
.ti-sunset .ti-body{font-size:var(--s-1);font-style:italic;color:var(--muted);padding-top:.12rem}
.ti-sunset .ti-body b{font-style:normal;font-weight:400;color:var(--ink2)}
.card-facts{margin:0 0 .6rem;padding:0 0 .5rem;border-bottom:1px solid var(--hair)}
.card-facts .eyebrow{font-size:var(--s-3);margin-bottom:.3rem}
.card-facts .card-notes{gap:.22rem;font-size:var(--s-2);line-height:1.38}
.card-facts .cn h4{color:var(--muted);padding-top:.12em}
.card-facts .card-src{margin-top:.3rem}
.season-lead{font-style:italic;margin:-.3rem 0 1.3rem;max-width:40rem}
.sec-season .pblock dl div{grid-template-columns:6.2rem 1fr}
.sec-season .pblock .chip{margin-right:.15rem;vertical-align:.1em}
.sec-season .pblock dd b{font-weight:400}
.ev-meta{font-size:var(--s-2);color:var(--muted)}
.ev-kind{font-size:var(--s-3);letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.ev-kind.ev-closure{color:var(--alert)}
.season-src ul{margin-top:.2rem}
.season-src li a{color:var(--sea);border-bottom-color:var(--sea-soft)}
@media (max-width:760px){
  html:not(.paged) .ev-list li{grid-template-columns:2.7rem .9rem minmax(0,1fr);gap:.3rem}
  html:not(.paged) .ev-m{display:block;margin-left:0}
  html:not(.paged) .sec-season .pblock dl div{grid-template-columns:5rem 1fr}
  html:not(.paged) .card-facts .cn{grid-template-columns:5.4rem minmax(0,1fr);gap:.45rem}
  html:not(.paged) .card-facts .cn h4{padding-top:.12em}
}
html.paged .tight .evening{padding:.38rem .65rem .4rem}
html.paged .tight .ev-list li{padding:.2rem 0}
html.paged .tight .dine-card{padding:.32rem .6rem .38rem}
`;
const SCREEN = `
html:not(.paged) body{background:var(--cream2)}
html:not(.paged) .doc{background:var(--paper)}
html:not(.paged) .sec{padding:3.2rem var(--gutter,2.5rem);max-width:60rem;margin:0 auto}
html:not(.paged) .sec-cover{max-width:none;min-height:100vh;padding:var(--m-top) var(--gutter,2.5rem) var(--m-bottom)}
html:not(.paged) .sec-day{display:grid;grid-template-columns:minmax(0,1fr) 17rem;grid-template-areas:"head head" "rail aside";column-gap:2.2rem}
html:not(.paged) .day-head{grid-area:head}
html:not(.paged) .day-aside{grid-area:aside;position:sticky;top:1.5rem}
html:not(.paged) .rail{grid-area:rail}
html:not(.paged) .sec+.sec{border-top:1px solid var(--rule)}
@media (max-width:760px){
  html:not(.paged) .sec{padding:2.2rem 1.1rem}
  html:not(.paged) .sec-cover{padding:2rem 1.1rem 1.6rem}
  html:not(.paged) .cover-title{font-size:var(--s7)}
  html:not(.paged) .cover-days{position:static;text-align:left;margin-bottom:1rem}
  html:not(.paged) .intro{columns:1}
  html:not(.paged) .glance-days{grid-template-columns:1fr}
  html:not(.paged) .glance-map{grid-template-columns:1fr}
  html:not(.paged) .cards,html:not(.paged) .later-lists,html:not(.paged) .pblocks{columns:1}
  html:not(.paged) .sec-day{grid-template-columns:1fr;grid-template-areas:"head" "aside" "rail"}
  html:not(.paged) .day-aside{position:static}
  html:not(.paged) .day-head{grid-template-columns:auto 1fr}
  html:not(.paged) .day-stats{grid-column:1/-1;border-left:0;padding-left:0;grid-template-columns:auto auto auto auto}
  html:not(.paged) .rail{--tcol:2.6rem;--mcol:1.5rem}
  html:not(.paged) .ti-name{font-size:var(--s1)}
  html:not(.paged) .cn{grid-template-columns:1fr}
  html:not(.paged) .cn h4{padding-top:0}
  html:not(.paged) .attr-google{grid-template-columns:1fr}
  html:not(.paged) .src-row{grid-template-columns:1fr;gap:.2rem}
  html:not(.paged) .src-row .what{text-align:left}
}
`;
/** Browser print without the paginator: page breaks by section, nothing split that should not be. */
function printFallback(page) {
  return `
@page{size:${page.css};margin:${page.margins.top}in ${page.margins.right}in ${page.margins.bottom}in ${page.margins.left}in}
@media print{
  html:not(.paged){font-size:10.5pt}
  html:not(.paged) body{background:#fff}
  html:not(.paged) .sec{padding:0;max-width:none;break-before:page}
  html:not(.paged) .sec-cover{min-height:auto;height:calc(var(--page-h) - var(--m-top) - var(--m-bottom));break-before:auto}
  html:not(.paged) .sec+.sec{border-top:0}
  html:not(.paged) .sec-day{display:block}
  html:not(.paged) .day-aside{float:right;width:2.5in;margin:0 0 .25in .35in;position:static}
  html:not(.paged) .ti,html:not(.paged) .card,html:not(.paged) .later-list,html:not(.paged) .pblock,html:not(.paged) .gday{break-inside:avoid}
  html:not(.paged) .sec-head,html:not(.paged) .day-head{break-after:avoid}
  a[href]{border-bottom:0}
}`;
}
/** Paged mode: the PDF step wraps blocks into fixed-size sheets (lib/paginate.mjs) and adds html.paged. */
const PAGED = `
html.paged{font-size:10.5pt}
html.paged body{background:#fff}
html.paged .sheet{position:relative;width:var(--page-w);height:var(--page-h);overflow:hidden;background:#fff;break-after:page;page-break-after:always}
html.paged .sheet-inner{position:absolute;left:var(--m-left);right:var(--m-right);top:var(--m-top);bottom:var(--m-bottom);overflow:hidden}
html.paged .sheet.bleed .sheet-inner{inset:0}
html.paged .sec{padding:0;margin:0;display:flow-root}
html.paged .sec-cover{display:flex;min-height:100%;height:100%;padding:var(--m-top) var(--m-right) var(--m-bottom) var(--m-left)}
html.paged .ti{padding:.42rem 0}
html.paged .ti-note{margin-top:.22rem;line-height:1.34}
html.paged .ti-meta{margin-top:.16rem}
html.paged .day-head{padding-bottom:.7rem;margin-bottom:.8rem}
html.paged .tight .ti{padding:.3rem 0}
html.paged .tight .ti-note{margin-top:.12rem;line-height:1.28}
html.paged .tight .ti-act{line-height:1.22}
html.paged .tight .ti-meta{margin-top:.1rem;line-height:1.35}
html.paged .tight .day-head{padding-bottom:.55rem;margin-bottom:.6rem}
html.paged .tight .card{margin-bottom:.9rem}
html.paged .tight .src-row,html.paged .tight .attr-reviews li{padding:.18rem 0}
html.paged .tight .attr h3{margin:.7rem 0 .25rem}
html.paged .tight .colophon{margin-top:.9rem;padding-top:.5rem}
html.paged .tight .attr-google{padding:.7rem .9rem;margin-bottom:.6rem}
html.paged .tight2 .rail,html.paged .tight2 .cards,html.paged .tight2 .attr,html.paged .tight2 .later-lists,html.paged .tight2 .pblocks,html.paged .tight2 .attr-google,html.paged .tight2 .colophon{zoom:.9}
html.paged .day-aside{float:right;width:2.55in;margin:0 0 .22in .38in}
html.paged .cards,html.paged .later-lists,html.paged .pblocks{columns:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 1.5rem;align-items:start}
html.paged .col{display:grid;gap:1.2rem;align-content:start}
html.paged .col>*{margin-bottom:0}
html.paged .folio{position:absolute;left:var(--m-left);right:var(--m-right);bottom:calc(var(--m-bottom) - .42in);display:flex;justify-content:space-between;font-size:7.4pt;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-variant-numeric:tabular-nums}
html.paged .folio .pn{color:var(--ink)}
html.paged .tab{position:absolute;right:0;top:1.15in;width:.26in;padding:.32in 0;background:var(--hue,var(--accent));color:#fff;font-size:7pt;letter-spacing:.18em;text-transform:uppercase;writing-mode:vertical-rl;text-align:center}
html.paged .sheet.cont .day-head{display:none}
html.paged .rail.rail-cont{margin-top:.1in}
html.paged .cont-note{font-size:var(--s-2);color:var(--muted);font-style:italic;margin-bottom:.4rem}
@media screen{html.paged body{background:#888;padding:1rem 0}html.paged .sheet{margin:0 auto 1rem;box-shadow:0 1px 6px rgba(0,0,0,.35)}}
@media print{html.paged .sheet{margin:0;box-shadow:none}}
`;

// Developed by: LightAISolutions
