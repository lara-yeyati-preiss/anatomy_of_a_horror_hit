// keyword analysis engine
// loads horror movie data, extracts and counts keywords per fear category,
// then populates the keyword tags in the HTML (both per-category and overall top 10)

// global storage for processed keyword data (accessed by app.js if needed)
window.keywordData = null;

// immediately invoked async function: load CSV and process keywords
;(async () => {
  // load the manually-categorized horror dataset (each row = one movie + its fear category)
  const data = await d3.csv('horror_categorized_clean_manualfix.csv');

  // normalize: lowercase, trim, collapse whitespace, strip quotes
  // ensures "Survival Horror" and "survival  horror" are treated as the same keyword
  const normalize = k =>
    k.toLowerCase().trim()
      .replace(/\s+/g, ' ')                // collapse multiple spaces to one
      .replace(/^["'\s]+|["'\s]+$/g, '');  // strip leading/trailing quotes and spaces

  // exclusion list: generic or non-thematic keywords that don't reveal fear types
  // (e.g., "sequel", "based on novel", geographical locations)
  const excludeKeywords = new Set([
    'sequel',
    'based on novel or book',
    'based on true story',
    'remake',
    'duringcreditsstinger',
    'california',
    'new york city',
    'south korea',
    'japan',
    'halloween'
  ]);

  // consolidation map: merge similar keywords under a single canonical term
  // example: "survival" and "survival horror" both become "survival"
  const keywordMapping = {
    'survival': ['survival', 'survival horror'],
    'haunted': ['haunted', 'haunted house', 'haunting'],
    'supernatural': ['supernatural', 'supernatural horror'],
    'possession': ['possession', 'demonic possession'],
  };

  // build reverse lookup: variant keyword → canonical keyword
  // so we can quickly map "haunted house" → "haunted" during processing
  const keywordLookup = new Map();
  for (const [canonical, variants] of Object.entries(keywordMapping)) {
    for (const variant of variants) {
      keywordLookup.set(variant, canonical);
    }
  }

  // apply consolidation: returns canonical keyword if mapped, else the original
  const mapKeyword = k => keywordLookup.get(k) || k;

  // explode: convert each movie row into multiple {category, keyword} pairs
  // (one movie can have multiple keywords, so we flatten them all)
  const catKwPairs = data.flatMap(d => {
    const cat = d.Fear_Category?.trim();
    const raw = d.TMDb_Keywords;
    if (!cat || !raw) return [];  // skip rows with missing data

    // split comma-separated keyword string, normalize each one
    const kws = raw.split(',')
      .map(normalize)
      .filter(k => k && k !== 'n/a' && k !== 'na');

    // apply exclusion filter to remove non-thematic keywords
    const filtered = kws.filter(k => !excludeKeywords.has(k));

    // apply consolidation mapping, then return as {category, keyword} pairs
    return filtered.map(k => ({ category: cat, keyword: mapKeyword(k) }));
  });

  // aggregate by category and keyword: count occurrences
  // result: Map(category -> Map(keyword -> count))
  const counts = d3.rollup(
    catKwPairs,
    v => v.length,
    d => d.category,
    d => d.keyword
  );

  // extract top 10 keywords per category, sorted by frequency
  const topPerCategory = Array.from(counts, ([category, kwMap]) => {
    const top = Array.from(kwMap)
      .sort((a, b) => d3.descending(a[1], b[1]))  // descending by count
      .slice(0, 10);  // take top 10
    return { category, top_keywords: top }; // [ [keyword, count], ... ]
  });

  // define supergroup mappings: which fear categories belong to which thematic family
  const supergroups = {
    'Societal & Structural Horrors': [
      'Invasion, Impostors & Paranoia',
      'Persecution & Social Breakdown',
      'Institutional & Structural Control'
    ],
    'Psychological & Domestic Horrors': [
      'Possession & Loss of Agency',
      'Isolation & Psychological Unraveling',
      'Grief & Familial Trauma'
    ],
    'The Body as Battleground': [
      'Captivity & Voyeuristic Sadism',
      'Contagion & Mutation',
      'Body Horror / Envelope Violation'
    ]
  };

  // aggregate keywords by supergroup (across all categories within each family)
  const supergroupKeywords = {};
  for (const [supergroupName, categories] of Object.entries(supergroups)) {
    // filter to only movies in this supergroup's categories
    const supergroupPairs = catKwPairs.filter(d => categories.includes(d.category));
    
    // count keywords across all categories in this supergroup
    const supergroupCounts = d3.rollup(
      supergroupPairs,
      v => v.length,
      d => d.keyword
    );
    
    // get top 10 for this supergroup
    const topKeywords = Array.from(supergroupCounts)
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10);
    
    supergroupKeywords[supergroupName] = topKeywords;
  }



  // calculate top 10 keywords across ALL horror movies (not per category or supergroup)
  const allKeywordCounts = d3.rollup(
    catKwPairs,
    v => v.length,
    d => d.keyword
  );
  
  // sort and take top 10 (already filtered and consolidated above)
  const top10Overall = Array.from(allKeywordCounts)
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 10);

  
  // store globally: make data accessible to app.js and HTML rendering
  window.keywordData = topPerCategory;  // per-category top 10
  window.supergroupKeywords = supergroupKeywords;  // per-supergroup top 10
  window.top10Keywords = top10Overall;  // overall top 10 (all horror)
  
  // dispatch custom event to signal that keyword data is ready
  // (app.js can listen for this if it needs to coordinate timing)
  window.dispatchEvent(new CustomEvent('keywordsLoaded', { detail: topPerCategory }));
  
  // render keywords into the HTML containers
  populateKeywords();
})();

// utility function: get top keywords for a specific category by name
// used if other scripts need programmatic access to category-specific keywords
window.getTopKeywords = (categoryName, limit = 10) => {
  if (!window.keywordData) return [];
  const categoryData = window.keywordData.find(d => d.category === categoryName);
  return categoryData ? categoryData.top_keywords.slice(0, limit) : [];
};

// render keywords into HTML: populate all keyword containers in the page
// handles both supergroup-aggregated keywords and overall top 10
function populateKeywords() {
  // map each HTML container ID to its data source (overall or supergroup)
  const containerMapping = [
    { id: 'overall-keywords', type: 'overall' },
    { id: 'societal-keywords', type: 'supergroup', name: 'Societal & Structural Horrors' },
    { id: 'psychological-keywords', type: 'supergroup', name: 'Psychological & Domestic Horrors' },
    { id: 'body-keywords', type: 'supergroup', name: 'The Body as Battleground' }
  ];
  
  // process each container: fetch keywords and render tags
  containerMapping.forEach(({ id, type, name }) => {
    const container = document.getElementById(id);
    if (!container) {
      console.warn(`Container not found: ${id}`);
      return;
    }
    
    let keywords = [];
    
    if (type === 'overall') {
      // overall top 10 (filter out keywords with count < 3 for cleaner display)
      if (window.top10Keywords) {
        keywords = window.top10Keywords.filter(([keyword, count]) => count >= 3);
      }
    } else if (type === 'supergroup') {
      // supergroup-specific keywords (filter count >= 3)
      if (window.supergroupKeywords && window.supergroupKeywords[name]) {
        keywords = window.supergroupKeywords[name].filter(([keyword, count]) => count >= 3);
      }
    }
    
    // render keyword tags as HTML, or show fallback if no data
    if (keywords.length > 0) {
      container.innerHTML = keywords
        .map(([keyword, count]) => `
          <div class="keyword-tag">
            <span class="keyword-name">${keyword}</span>
            <span class="keyword-count">${count}</span>
          </div>
        `).join('');
    } else {
      container.innerHTML = '<span class="keyword-loading">No keywords found</span>';
    }
  });
}