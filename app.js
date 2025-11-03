// wait for DOM, then run main async function

async function main() {
  // set up D3 selections for chart components
  const svg     = d3.select("#viz");                      // main SVG canvas
  const gRoot   = svg.append("g").attr("class", "chart-root");  // root group for all chart layers
  const gChart  = gRoot.append("g").attr("class", "chart-layer");   // layer for data marks (bubbles/bars)
  const gAxis   = gRoot.append("g").attr("class", "axes-layer");    // layer for axes + quadrant guides
  const gLegend = gRoot.append("g").attr("class", "legend-layer");  // layer for legend (scatter only)

  const titleEl = d3.select("#chart-title");       // chart title element (updates per scene)
  const subtitleEl = d3.select("#chart-subtitle"); // chart subtitle element (updates per scene)
  const tooltip = d3.select(".tooltip");           // shared tooltip for hover interactions

  // chart dimensions and margins (matches the SVG viewBox in index.html)
  const width  = 1000;
  const height = 720;
  const margin = { top: 60, right: 220, bottom: 120, left: 80 };

  // fine-note helpers
  // the fine-note explains that movies can have multiple genres (total > unique titles)
  // visible during scatter scenes, hidden during bar scenes
  const showFineNote = () => d3.select(".fine-note").classed("note-hidden", false);
  const hideFineNote = () => d3.select(".fine-note").classed("note-hidden", true);

  // global state variables track visualization mode and data
  let mode = "none";            // current viz mode: "scatter" | "bars" | "none"
  let fearRows = null;          // lazy-loaded CSV data for bar charts
  let quadrantsAdded = false;   // flag: have quadrant overlays been added to scatter?
  let isHorrorFocused = false;  // flag: is horror genre currently focused (others dimmed)?

  // fear categories list
  const FEAR_CATEGORY_NAMES = [
  "Invasion, Impostors & Paranoia",
  "Persecution & Social Breakdown",
  "Institutional & Structural Control",
  "Possession & Loss of Agency",
  "Captivity & Voyeuristic Sadism",
  "Contagion & Mutation",
  "Body Horror / Envelope Violation",  // data name (in CSV)
  "Ecological / Natural Menace",
  "Isolation & Psychological Unraveling",
  "Grief & Familial Trauma",
  "Transgression & Moral Punishment"
];

  const FEAR_SET = new Set(FEAR_CATEGORY_NAMES);

  // display name mapping
  // map data names to shorter display names for frontend
  const getDisplayName = (categoryName) => {
    if (categoryName === "Body Horror / Envelope Violation") {
      return "Body Horror";
    }
    return categoryName;
  };

  // fear category descriptions for tooltips
  const FEAR_CATEGORY_DESCRIPTIONS = {
    "Invasion, Impostors & Paranoia":
      "Fear of being replaced, infiltrated, or observed by hidden others — aliens, doubles, or unseen conspirators disrupting normal life.",

    "Persecution & Social Breakdown":
      "Fear of mob violence, cult domination, or the collapse of moral order — when collective madness replaces reason and safety.",

    "Institutional & Structural Control":
      "Fear of domination by organized systems — governments, corporations, cults, or algorithms that erase autonomy and identity.",

    "Possession & Loss of Agency":
      "Fear of losing control of one's mind or body to supernatural or psychological forces — demonic, psychic, or manipulative influence.",

    "Captivity & Voyeuristic Sadism":
      "Fear of imprisonment, coercion, and deliberate human cruelty — torture, rape-revenge, or sadistic games that turn pain into spectacle.",

    "Contagion & Mutation":
      "Fear of infection or involuntary biological transformation — viruses, parasites, or spreading contamination altering the body.",

    "Body Horror":
      "Fear of bodily invasion, forced metamorphosis, or dismemberment — the body violated or remade beyond recognition.",

    "Ecological / Natural Menace":
      "Fear of nature turning hostile — animals, weather, or landscapes striking back against human control and exploitation.",

    "Isolation & Psychological Unraveling":
      "Fear that solitude itself becomes the menace — prolonged isolation leading to paranoia, madness, and collapse of meaning.",

    "Grief & Familial Trauma":
      "Fear rooted in loss, inheritance, or haunted domestic bonds — when family, grief, or lineage becomes the source of horror.",

    "Transgression & Moral Punishment":
      "Fear of violating sacred or moral boundaries and suffering retribution — curses, pacts, or divine punishment for human sin."
  };

  // supergroups of fear categories
  // groups the 11 categories into 4 thematic families
const FEAR_GROUP_MAP = new Map([
  // 🟢 Societal & Structural Horrors
  ["Invasion, Impostors & Paranoia", "Societal & Structural Horrors"],
  ["Persecution & Social Breakdown", "Societal & Structural Horrors"],
  ["Institutional & Structural Control", "Societal & Structural Horrors"],

  // 🔴 The Body as Battleground
  ["Captivity & Voyeuristic Sadism", "The Body as Battleground"],
  ["Contagion & Mutation", "The Body as Battleground"],
  ["Body Horror / Envelope Violation", "The Body as Battleground"],

  // 🔵 Psychological & Internal Horrors
  ["Possession & Loss of Agency", "Psychological & Domestic Horrors"],
  ["Isolation & Psychological Unraveling", "Psychological & Domestic Horrors"],
  ["Grief & Familial Trauma", "Psychological & Domestic Horrors"],

  // ⚫ Cosmic & Moral Reckonings
  ["Ecological / Natural Menace", "Cosmic & Moral Reckonings"],
  ["Transgression & Moral Punishment", "Cosmic & Moral Reckonings"]
]);


  // data load + prep
  // load the main Netflix + OMDb merged dataset and prepare for visualization
  // raw data has one row per movie, with genres as comma-separated strings
  // explode multi-genre movies so each genre gets its own row, then aggregate
  const movies = await d3.csv("./netflix_omdb_master.csv");

  // explode multi-genre rows into individual (movie, genre) pairs
  // example: "Horror, Thriller, Mystery" becomes 3 rows
  // lets us count genres independently (noted in chart's fine print)
  const exploded = [];
  movies.forEach(m => {
    // skip rows with missing data
    if (!m.OMDb_Genre || !m.Views || !m.OMDb_imdbRating) return;
    
    // split comma-separated genre string into individual genres
    m.OMDb_Genre.split(", ").forEach(g => {
      exploded.push({
        genre  : g.trim(),                                  // clean whitespace
        views  : +String(m.Views).replace(/,/g, ""),        // parse views as number
        rating : +m.OMDb_imdbRating                         // parse rating as number
      });
    });
  });

  // aggregate by genre: count movies, average rating, sum views
  // d3.rollup groups by genre and reduces each group to summary stats
  const rolled = d3.rollup(
    exploded,
    v => ({
      count       : v.length,                   // number of movies in this genre
      avg_imdb    : d3.mean(v, d => d.rating),  // average IMDB rating
      total_views : d3.sum(v,  d => d.views),   // total views across all movies
    }),
    d => d.genre
  );

  // convert from Map to array, filter out rare genres (< 5 movies)
  // gives clean list for scatterplot, removing statistical noise
  const genreData = Array.from(rolled, ([genre, values]) => ({ genre, ...values }))
                         .filter(d => d.count >= 5);

  // scales
  // D3 scales map data values → visual properties (position, size, color)
  // set up once at initialization, used by both scatter and bars
  
  // x scale: maps average IMDB rating → horizontal position
  const x = d3.scaleLinear()
    .domain(d3.extent(genreData, d => d.avg_imdb)).nice()  // auto-extend to round numbers
    .range([margin.left, width - margin.right]);

  // y scale: maps total views → vertical position (inverted: high values at top)
  const y = d3.scaleLinear()
    .domain([0, d3.max(genreData, d => d.total_views) * 1.1]).nice()  // add 10% headroom
    .range([height - margin.bottom, margin.top]);                      // inverted (SVG Y grows down)

  // radius scale: maps movie count → bubble size (sqrt scale for area proportionality)
  const r = d3.scaleSqrt()
    .domain([0, d3.max(genreData, d => d.count)])
    .range([5, 50]);

  // color scale: maps movie count → CSS class name (threshold scale for categorical bins)
  // classes defined in styles.css with project's color palette
  const colorScale = d3.scaleThreshold()
    .domain([50, 200, 500, 1000, 2000])
    .range([
      "color-cat-6", "color-cat-5", "color-cat-4",
      "color-cat-3", "color-cat-2", "color-cat-1"
    ]);

  // crossfades
  // utility functions to smoothly transition between different chart states
  // used when switching from scatter → bars or between bar variants
  
  // fade out a set of D3 selection groups, then optionally run a callback once
  function crossfadeOut(groups, ms = 220, easing = d3.easeCubicOut, afterOnce) {
    const t = d3.transition().duration(ms).ease(easing);
    let called = false;  // guard to ensure callback fires only once
    
    groups.forEach(g => g.transition(t).style("opacity", 0));
    
    if (afterOnce) t.on("end", () => { if (!called) { called = true; afterOnce(); } });
  }
  
  // fade in a set of D3 selection groups
  function crossfadeIn(groups, ms = 260, easing = d3.easeCubicIn) {
    groups.forEach(g => g.style("opacity", 0));  // start invisible
    
    const t = d3.transition().duration(ms).ease(easing);
    groups.forEach(g => g.transition(t).style("opacity", 1));
  }

  // scatter draw
  // draws the genre scatterplot (bubbles positioned by rating vs views)
  function drawScatter() {
    showFineNote();
    mode = "scatter";
    tooltip.style("opacity", 0);

    // clear layers
    gChart.selectAll("*").remove();
    gAxis.selectAll("*").remove();
    gLegend.selectAll("*").remove();

    // bubbles
    gChart.selectAll(".genre-bubble")
      .data(genreData, d => d.genre)
      .join("circle")
      .attr("class", d => `genre-bubble ${colorScale(d.count)}`)
      .attr("cx", d => x(d.avg_imdb))
      .attr("cy", d => y(d.total_views))
      .attr("r", 0)
      .transition().duration(400)
      .attr("r", d => r(d.count));

    // axes (quadrants added later when baseline card activates)
    gAxis.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat(d => d.toFixed(1)));

    gAxis.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(10).tickFormat(d => d3.format(".2s")(d).replace('G','B')));

    // axis labels
    gAxis.append("text")
      .attr("class", "x-label")
      .attr("x", margin.left + (width - margin.left - margin.right) / 2)
      .attr("y", height - margin.bottom + 50)
      .attr("text-anchor", "middle")
      .text("Average IMDB Rating");

    gAxis.append("text")
      .attr("class", "y-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
      .attr("y", margin.left - 60)
      .attr("text-anchor", "middle")
      .text("Total Views");

    // quadrants added when baseline card activates
    quadrantsAdded = false;

    // only top 10 labels for readability
    const top10 = [...genreData].sort((a,b) => b.total_views - a.total_views).slice(0, 10);
    gChart.selectAll(".genre-label")
      .data(top10, d => d.genre)
      .join("text")
      .attr("class", "genre-label")
      .attr("x", d => x(d.avg_imdb))
      .attr("y", d => y(d.total_views) - r(d.count) - 12)
      .text(d => d.genre);

    // tooltips
    svg.selectAll(".genre-bubble")
      .on("mouseover", (_, d) => {
        if (mode !== "scatter") return;
        tooltip.style("opacity", 1).html(
          `<strong>Genre:</strong> ${d.genre}<br/>
           <strong>Number of Movies:</strong> ${d3.format(",")(d.count)}<br/>
           <strong>Average IMDB Rating:</strong> ${d.avg_imdb.toFixed(2)}<br/>
           <strong>Total Views:</strong> ${d3.format(",")(d.total_views)}`
        );
      })
      .on("mousemove", (event) => {
        if (mode !== "scatter") return;
        tooltip.style("left", (event.clientX + 15) + "px")
               .style("top",  (event.clientY + 15) + "px");
      })
      .on("mouseout", () => { if (mode === "scatter") tooltip.style("opacity", 0); });

    // legend for scatter (by bubble color = movie count)
    const legendCategories = [
      { label: "2001+",        class: "color-cat-1" },
      { label: "1001 - 2000",  class: "color-cat-2" },
      { label: "501 - 1000",   class: "color-cat-3" },
      { label: "201 - 500",    class: "color-cat-4" },
      { label: "51 - 200",     class: "color-cat-5" },
      { label: "5 - 50",       class: "color-cat-6" }
    ];
    
    // legend group, positioned to right of chart area
    const legend = gLegend.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - margin.right + 40}, ${margin.top})`);

    legend.append("text")
      .attr("class", "legend-title")
      .attr("x", 0).attr("y", 0)
      .text("Number of Movies");

    // legend items (circles + text)
    const legendItems = legend.selectAll(".legend-item")
      .data(legendCategories).join("g")
      .attr("class", "legend-item")
      .attr("transform", (_, i) => `translate(0, ${(i * 25) + 20})`);  // vertically stack with 25px spacing

    legendItems.append("circle").attr("r", 8).attr("class", d => d.class);
    legendItems.append("text").attr("x", 15).attr("y", 4).text(d => d.label);
  }

  // quadrants overlay
  // adds crosshairs and corner labels to divide scatter into four quadrants:
  // - high rating + high views   = "Prestige Powerhouses"
  // - low rating + high views    = "Crowd Magnets"
  // - high rating + low views    = "Critical Darlings"
  // - low rating + low views     = "Cult Gems"
  // function is idempotent (only draws once, even if called multiple times)
  function addQuadrantsIfNeeded() {
    if (quadrantsAdded) return;  // already added → bail out

    quadrantsAdded = true;
    
    // calculate mean values for crosshair positions
    const meanRating = d3.mean(genreData, d => d.avg_imdb);  // vertical line
    const meanViews  = d3.mean(genreData, d => d.total_views);  // horizontal line
    
    // layout offsets for labels and annotations
    const pad = 30, bottomPad = 30, labelOffset = 10;

    // draw vertical crosshair line at mean rating
    gAxis.append("line").attr("class", "quadrant-line")
      .attr("x1", x(meanRating)).attr("y1", margin.top)
      .attr("x2", x(meanRating)).attr("y2", height - margin.bottom);

    // draw horizontal crosshair line at mean views
    gAxis.append("line").attr("class", "quadrant-line")
      .attr("x1", margin.left).attr("y1", y(meanViews))
      .attr("x2", width - margin.right).attr("y2", y(meanViews));

    // corner labels for each quadrant (positioned near chart corners)
    // top-right: high rating, high views
    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", width - margin.right).attr("y", margin.top + pad)
      .attr("text-anchor", "end").text("Prestige Powerhouses");

    // top-left: low rating, high views
    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", margin.left + pad).attr("y", margin.top + pad)
      .attr("text-anchor", "start").text("Crowd Magnets");

    // bottom-right: high rating, low views
    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", width - margin.right).attr("y", height - margin.bottom - bottomPad)
      .attr("text-anchor", "end").text("Critical Darlings");

    // bottom-left: low rating, low views
    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", margin.left + pad).attr("y", height - margin.bottom - bottomPad)
      .attr("text-anchor", "start").text("Cult Gems");

    // numeric annotations showing the mean values (positioned above/beside the lines)
    // vertical line annotation (mean rating)
    gAxis.append("text").attr("class", "quadrant-axis-label")
      .attr("x", x(meanRating)).attr("y", margin.top - labelOffset)
      .text(`Avg. Rating: ${meanRating.toFixed(2)}`);

    // horizontal line annotation (mean views, positioned to the right)
    gAxis.append("text").attr("class", "quadrant-axis-label horizontal")
      .attr("x", width - margin.right + labelOffset + 35)
      .attr("y", y(meanViews))
      .text(`Avg. Views: ${d3.format(".2s")(meanViews).replace('G','B')}`);
  }

  /* ---------------------------- horror focus ------------------------------ */
  // dims all non-horror genres in the scatter plot to spotlight horror.
  // used by the "horror" scene to guide the reader's attention.
  // also updates the title to reflect the focused state.
  
function focusHorror(on) {
  isHorrorFocused = on;  // update global flag

  // update title
  titleEl.text(on ? "Horror in the Hit Matrix" : "The Hit Matrix");

  // helper to check non-horror
  const notHorror = d => d.genre?.toLowerCase() !== "horror";

  // toggle dimming + pointer interactivity
  svg.selectAll(".genre-bubble")
    .classed("dimmed", d => on && notHorror(d))
    .style("pointer-events", d => (on && notHorror(d)) ? "none" : "all");

  svg.selectAll(".genre-label")
    .classed("dimmed", d => on && notHorror(d))
    .style("pointer-events", d => (on && notHorror(d)) ? "none" : "all");
}

  /* ---------------------------- quadrant focus ------------------------------ */
  // dims bubbles outside a specific quadrant to guide reader attention.
  // used by high-views, critical-darlings, and cult-corner scenes.
  
  function focusQuadrant(quadrant) {
    console.log("focusQuadrant called with:", quadrant);
    
    // calculate mean values for filtering
    const meanRating = d3.mean(genreData, d => d.avg_imdb);
    const meanViews  = d3.mean(genreData, d => d.total_views);
    
    console.log("Mean rating:", meanRating, "Mean views:", meanViews);
    
    // filter function based on quadrant type
    let shouldDim;
    if (quadrant === "high-views") {
      // highlight ONLY comedy, action, and drama - dim everything else
      shouldDim = d => {
        const genre = (d.genre || "").toLowerCase();
        return !(genre === "comedy" || genre === "action" || genre === "drama");
      };
    } else if (quadrant === "critical-darlings") {
      // highlight only bubbles in bottom-right: high rating (right of line) + low views (below line)
      // dim if NOT in critical darlings quadrant
      shouldDim = d => {
        const isDimmed = (d.avg_imdb <= meanRating || d.total_views >= meanViews);
        console.log(`${d.genre}: rating=${d.avg_imdb}, views=${d.total_views}, dimmed=${isDimmed}`);
        return isDimmed;
      };
    } else if (quadrant === "cult-corner") {
      // highlight ONLY horror bubble - dim everything else
      shouldDim = d => {
        const genre = (d.genre || "").toLowerCase();
        return genre !== "horror";
      };
    } else {
      // "none" or any other value: remove all dimming
      shouldDim = () => false;
    }
    
    // apply dimming and disable interactivity for dimmed bubbles
    svg.selectAll(".genre-bubble")
      .classed("dimmed", shouldDim)
      .style("pointer-events", d => shouldDim(d) ? "none" : "all");
    
    svg.selectAll(".genre-label")
      .classed("dimmed", shouldDim)
      .style("pointer-events", d => shouldDim(d) ? "none" : "all");
  }

  /* ---------------------------- horror zoom ------------------------------ */
  // zooms into horror bubble, hides all others, makes horror big and black
  // used by the horror-zoom scene (final scatter scene before bars)
  
  function zoomToHorror() {
    // find horror data
    const horrorData = genreData.find(d => d.genre?.toLowerCase() === "horror");
    if (!horrorData) return;
    
    // hide all non-horror bubbles and labels completely - use display:none for complete removal
    svg.selectAll(".genre-bubble")
      .filter(d => d.genre?.toLowerCase() !== "horror")
      .transition().duration(800)
      .style("opacity", 0)
      .on("end", function() { d3.select(this).style("display", "none"); });
    
    // hide all non-horror labels completely (including the original horror label)
    svg.selectAll(".genre-label")
      .transition().duration(800)
      .style("opacity", 0)
      .on("end", function() { d3.select(this).style("display", "none"); });
    
    // calculate new axis domains centered on horror (zoom in effect)
    const horrorRating = horrorData.avg_imdb;
    const horrorViews = horrorData.total_views;
    
    // create tighter scales around horror to push other bubbles out of view
    const xPadding = 1.5;
    const yPadding = horrorViews * 0.8;
    
    const xZoom = d3.scaleLinear()
      .domain([horrorRating - xPadding, horrorRating + xPadding])
      .range([margin.left, width - margin.right]);
    
    const yZoom = d3.scaleLinear()
      .domain([horrorViews - yPadding, horrorViews + yPadding])
      .range([height - margin.bottom, margin.top]);
    
    // update axes with new zoomed scales
    gAxis.select(".x-axis")
      .transition().duration(800)
      .call(d3.axisBottom(xZoom).ticks(5).tickFormat(d => d.toFixed(1)));
    
    gAxis.select(".y-axis")
      .transition().duration(800)
      .call(d3.axisLeft(yZoom).ticks(6).tickFormat(d => d3.format(".2s")(d).replace('G','B')));
    
    // hide axis labels
    gAxis.selectAll(".x-label, .y-label")
      .transition().duration(800)
      .style("opacity", 0);
    
    // make horror bubble much bigger and turn it black
    svg.selectAll(".genre-bubble")
      .filter(d => d.genre?.toLowerCase() === "horror")
      .transition().duration(800)
      .attr("cx", xZoom(horrorRating))
      .attr("cy", yZoom(horrorViews))
      .attr("r", 200)  // even bigger radius for dramatic effect
      .style("fill", "#1D1C1C")  // black color
      .style("opacity", 1)
      .style("display", "block");
    
    // create a new centered label on the horror bubble - much larger
    // remove any existing centered horror label first
    svg.selectAll(".horror-center-label").remove();
    
    svg.append("text")
      .attr("class", "horror-center-label")
      .attr("x", xZoom(horrorRating))
      .attr("y", yZoom(horrorViews))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-family", "Libre Baskerville, serif")
      .style("font-size", "60px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("opacity", 0)
      .text("Horror")
      .transition().duration(800)
      .style("opacity", 1);
    
    // hide the legend
    gLegend.transition().duration(800)
      .style("opacity", 0);
    
    // hide quadrant lines and labels
    gAxis.selectAll(".quadrant-line, .quadrant-label, .quadrant-axis-label")
      .transition().duration(800)
      .style("opacity", 0);
  }
  
  /* ---------------------------- restore from horror zoom ------------------------------ */
  // restores scatter to normal state after horror zoom
  // used when scrolling back up from horror-zoom to earlier scenes
  
  function restoreFromHorrorZoom() {
    // restore all bubbles to normal opacity and original positions
    // restore all bubbles (opacity, position, size, and display)
    svg.selectAll(".genre-bubble")
      .style("display", "block")  // restore display first
      .transition().duration(600)
      .style("opacity", 0.8)
      .attr("cx", d => x(d.avg_imdb))
      .attr("cy", d => y(d.total_views))
      .attr("r", d => r(d.count))
      .style("fill", null);  // restore original color classes
    
    // restore labels (opacity, font size, font weight, display, and position)
    svg.selectAll(".genre-label")
      .style("display", "block")  // restore display first
      .transition().duration(600)
      .style("opacity", 1)
      .style("font-size", null)       // restore original font size
      .attr("font-size", null)        // clear font-size attribute
      .style("font-weight", null)     // restore original font weight
      .attr("x", d => x(d.avg_imdb))
      .attr("y", d => y(d.total_views) - r(d.count) - 12);
    
    // remove the centered horror label
    svg.selectAll(".horror-center-label")
      .transition().duration(600)
      .style("opacity", 0)
      .remove();
    
    // restore axes to original scales
    gAxis.select(".x-axis")
      .transition().duration(600)
      .call(d3.axisBottom(x).ticks(10).tickFormat(d => d.toFixed(1)));
    
    gAxis.select(".y-axis")
      .transition().duration(600)
      .call(d3.axisLeft(y).ticks(10).tickFormat(d => d3.format(".2s")(d).replace('G','B')));
    
    // restore axis labels
    gAxis.selectAll(".x-label, .y-label")
      .transition().duration(600)
      .style("opacity", 1);
    
    // restore legend
    gLegend.transition().duration(600)
      .style("opacity", 1);
    
    // restore quadrants if they were added
    if (quadrantsAdded) {
      gAxis.selectAll(".quadrant-line, .quadrant-label, .quadrant-axis-label")
        .transition().duration(600)
        .style("opacity", 1);
    }
  }

  /* --------------------------- bars (14 categories) ----------------------- */
  async function drawFearBars() {
    hideFineNote();                         // bars do not show the fine note
    if (!fearRows) fearRows = await d3.csv("./horror_categorized_clean_manualfix.csv");

    mode = "bars";
    tooltip.style("opacity", 0);

    // clear layers, including legend (not used in bars)
    gChart.selectAll("*").remove();
    gAxis.selectAll("*").remove();
    gLegend.selectAll("*").remove();
    
    // explicitly remove the centered horror label if it exists
    svg.selectAll(".horror-center-label").remove();

    // filter → count → sort
    // only the canonical 14 fear categories, ignore any others or blanks
    const filtered = fearRows.filter(d => FEAR_SET.has((d.Fear_Category || "").trim()));
    const counts = d3.rollups(
      filtered,
      v => v.length,
      d => (d.Fear_Category || "").trim()
    )
      .map(([fear, count]) => ({ fear, count }))
      .sort((a, b) => d3.descending(a.count, b.count));

    // scales (horizontal bars: categories on Y, counts on X)
    const leftForBars = 280;  // extra left padding for long category labels
    const yBar = d3.scaleBand()
      .domain(counts.map(d => d.fear))
      .range([margin.top, height - margin.bottom])
      .padding(0.18);

    const xBar = d3.scaleLinear()
      .domain([0, d3.max(counts, d => d.count)]).nice()
      .range([leftForBars, width - margin.right]);

    // bars title
    titleEl.text("What Are We Afraid of?");

    // bars subtitle
    subtitleEl.text("Horror titles from Netflix’s Most-Watched Movies (Jan–Jun 2025), divided into the main core fears represented in each film.");

    // axes
    const yAxis = gAxis.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${leftForBars}, 0)`)
      .call(d3.axisLeft(yBar).tickSizeOuter(0).tickFormat(d => getDisplayName(d)));

    yAxis.selectAll("text")
      .attr("text-anchor", "end")
      .attr("dx", "-0.4em")
      .style("font-family", "Libre Baskerville, serif")
      .style("font-size", "15px")
      .style("font-style", "italic")
      .style("font-weight", "500")
      .style("fill", "#333");

    gAxis.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xBar).ticks(6));

    // x-axis label
    gAxis.append("text")
      .attr("class", "x-label")
      .attr("x", leftForBars + (width - leftForBars - margin.right) / 2)
      .attr("y", height - margin.bottom + 50)
      .attr("text-anchor", "middle")
      .text("Total movies");

    // bars
    gChart.selectAll("rect")
      .data(counts, d => d.fear)
      .join("rect")
      .attr("x", leftForBars)
      .attr("y", d => yBar(d.fear))
      .attr("width", 0)
      .attr("height", yBar.bandwidth())
      .attr("class", "color-cat-1")
      .transition().duration(600)
      .attr("width", d => xBar(d.count) - leftForBars);

    // tooltips
    gChart.selectAll("rect")
      .on("mouseover", (_, d) => {
        const description = FEAR_CATEGORY_DESCRIPTIONS[d.fear] || "";
        tooltip.style("opacity", 1).html(
          `<strong>${d.fear}</strong><br/>
           Total movies: ${d.count}
           <div style="font-size: 13px; line-height: 1.5; margin: 8px 0; color: #666;">${description}</div>`
        );
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.clientX + 15) + "px")
               .style("top",  (event.clientY + 15) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  /* ---------------------------- bars focus ------------------------------ */
  // dims bars based on their index position (similar to focusQuadrant for scatter)
  // used to highlight specific bars (e.g., top 2) while dimming others
  
  function focusBars(focusCount = null) {
    if (mode !== "bars") return;  // only works in bars mode
    
    // if focusCount is null or "none", remove all dimming
    if (focusCount === null || focusCount === "none") {
      gChart.selectAll("rect")
        .classed("dimmed", false)
        .style("pointer-events", "all");
      return;
    }
    
    // dim all bars except the first 'focusCount' bars
    gChart.selectAll("rect")
      .classed("dimmed", (d, i) => i >= focusCount)
      .style("pointer-events", (d, i) => i >= focusCount ? "none" : "all");
  }

  /* ---------------------------- bars focus by supergroup ------------------------------ */
  // dims bars except those belonging to a specific supergroup
  // used to highlight categories within one thematic group
  
  function focusBarsBySupergroup(supergroupName = null) {
    if (mode !== "bars") return;  // only works in bars mode
    
    // if supergroupName is null or "none", remove all dimming
    if (supergroupName === null || supergroupName === "none") {
      gChart.selectAll("rect")
        .classed("dimmed", false)
        .style("pointer-events", "all");
      return;
    }
    
    // dim all bars except those in the specified supergroup
    gChart.selectAll("rect")
      .classed("dimmed", d => {
        const group = FEAR_GROUP_MAP.get(d.fear);
        return group !== supergroupName;
      })
      .style("pointer-events", d => {
        const group = FEAR_GROUP_MAP.get(d.fear);
        return group !== supergroupName ? "none" : "all";
      });
  }

  /* --------------------------- bars (supergroups) --------------------------- */
  //   similar to drawFearBars but groups the 14 categories into 3 macro groups
  async function drawFearBarsGrouped() {
    hideFineNote();                         // hidden for bars
    if (!fearRows) fearRows = await d3.csv("./horror_categorized_clean.csv");

    mode = "bars";
    tooltip.style("opacity", 0);

    // clear layers, including legend (not used in bars)
    gChart.selectAll("*").remove();
    gAxis.selectAll("*").remove();
    gLegend.selectAll("*").remove();
    
    // explicitly remove the centered horror label if it exists
    svg.selectAll(".horror-center-label").remove();

    // filter to canonical list, map to macro group, then count/sort
    // ignore any non-canonical categories or blanks
    const filtered = fearRows.filter(d => FEAR_SET.has((d.Fear_Category || "").trim()));
    const groupedCounts = d3.rollups(
      filtered,
      v => v.length,
      d => FEAR_GROUP_MAP.get((d.Fear_Category || "").trim()) || "Unmapped"
    )
      .filter(([k]) => k !== "Unmapped")
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => d3.descending(a.count, b.count));

    const leftForBars = 280;  // extra left padding for long category labels
    const yBar = d3.scaleBand()
      .domain(groupedCounts.map(d => d.group))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);

    const xBar = d3.scaleLinear()
      .domain([0, d3.max(groupedCounts, d => d.count)]).nice()
      .range([leftForBars, width - margin.right]);

    // bars title, same as ungrouped bars
    titleEl.text("What Are We Afraid of?");

    // bars subtitle, updated to note grouping
    subtitleEl.text("Horror titles from Netflix’s Most-Watched Movies (Jan–Jun 2025), grouped by core fear types represented in each film.");

    // axes
    const yAxis = gAxis.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${leftForBars}, 0)`)
      .call(d3.axisLeft(yBar).tickSizeOuter(0));

    // only 3 bars → make labels a bit larger
    yAxis.selectAll("text")
      .style("font-family", "Libre Baskerville, serif")
      .style("font-size", "15px")
      .style("font-style", "italic")
      .style("font-weight", "500")
      .style("fill", "#333");

    gAxis.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xBar).ticks(6));

    // x-axis label
    gAxis.append("text")
      .attr("class", "x-label")
      .attr("x", leftForBars + (width - leftForBars - margin.right) / 2)
      .attr("y", height - margin.bottom + 50)
      .attr("text-anchor", "middle")
      .text("Total movies");

    // bars
    gChart.selectAll("rect")
      .data(groupedCounts, d => d.group)
      .join("rect")
      .attr("x", leftForBars)
      .attr("y", d => yBar(d.group))
      .attr("width", 0)
      .attr("height", yBar.bandwidth())
      .attr("class", "color-cat-1")
      .transition().duration(600)
      .attr("width", d => xBar(d.count) - leftForBars);

    // tooltips
    gChart.selectAll("rect")
      .on("mouseover", (_, d) => {
        tooltip.style("opacity", 1).html(
          `<strong>${d.group}</strong><br/>Total movies: ${d.count}`
        );
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.clientX + 15) + "px")
               .style("top",  (event.clientY + 15) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  /* ------------------------- title utility (per step) --------------------- */
  // updates the chart title based on the active card's data-title attribute.
  // exception: when in bars mode, the title is managed by the bar-drawing functions
  // (both bar scenes use "What Are We Afraid of?"), so we skip overrides.
  function applyStepTitle(stepEl) {
    const t = stepEl?.getAttribute("data-title");  // read data-title from the card
    if (!t) return;                                // no title set → do nothing
    
    // don't override the bars title—bars scenes handle their own titles
    if (mode === "bars") return;
    
    titleEl.text(t);  // update the chart title
  }

  /* ------------------------- subtitle utility (per step) --------------------- */
  // updates the chart subtitle based on the active card's data-subtitle attribute.
  // like title, we skip overrides in bars mode (bars set their own subtitles).
  function applyStepSubtitle(stepEl) {
    // mirror title behavior: don't override during bars mode
    if (mode === "bars") return;

    const s = stepEl?.getAttribute("data-subtitle");  // read data-subtitle from card
    if (s) subtitleEl.text(s);                        // update subtitle if present
  }

  /* ------------------------- special effects (per step) ------------------- */
  // reserved for future step-specific effects (e.g., data-fx="prebars").
  // currently a no-op, but ensures the scrollytelling engine doesn't break
  // when calling this function. can be extended for animations, annotations, etc.
  function applyStepFX() {
    // intentionally empty—placeholder for future enhancements
    // example use: read data-fx attribute and trigger custom animations
  }

  /* ------------------------- methodology button visibility ------------------- */
  // show/hide the methodology button based on the scene
  const methodologyBtn = document.getElementById("methodology-btn");
  
  function showMethodologyBtn() {
    if (methodologyBtn) methodologyBtn.style.display = "block";
  }
  
  function hideMethodologyBtn() {
    if (methodologyBtn) methodologyBtn.style.display = "none";
  }

  /* ------------------------------- router --------------------------------- */
  // the router is the heart of the scrollytelling logic: it receives a scene name
  // (from a card's data-scene attribute) and orchestrates the visual transition.
  // 
  // scene types:
  //   "baseline"      : draw scatter chart, then overlay quadrants (first card behavior)
  //   "quadrants"     : alias for baseline (ensures scatter + quadrants are visible)
  //   "high-views"    : highlight only genres above the mean views line (crowd magnets + prestige)
  //   "critical-darlings" : highlight only bottom-right quadrant (high rating, low views)
  //   "horror"        : keep scatter + quadrants, but dim all non-horror bubbles
  //   "bars"          : crossfade from scatter to the 14-category fear bar chart
  //   "bars_grouped"  : crossfade to the 3-supergroup fear bar chart
  //   "grouped"       : alias for bars_grouped
  //   "noop"          : do nothing—copy-only card that doesn't change the viz
  //
  // each scene manages:
  //   1. what to draw (scatter vs bars)
  //   2. what overlays to add/remove (quadrants, focus effects)
  //   3. transitions (crossfades, dimming)

  function go(scene) {
    // BASELINE: initial scatter view with quadrants
    // this is typically triggered by the first narrative card
    if (scene === "baseline") {
      hideMethodologyBtn();  // hide button for scatter scenes
      // restore from horror-zoom if coming back from that scene
      restoreFromHorrorZoom();
      
      // if we're not already showing a scatter, draw it fresh
      if (mode !== "scatter") {
        titleEl.text("The Hit Matrix");    // set the scatter title
        drawScatter();                     // draws bubbles, axes, legend; shows fine note
      } else {
        showFineNote();                    // if already in scatter, just ensure note is visible
      }
      // now overlay the quadrants (mean lines + corner labels)
      // addQuadrantsIfNeeded() is idempotent—it only adds them once
      addQuadrantsIfNeeded();
      // unfocus horror if we're scrolling back from a horror scene
      if (isHorrorFocused) focusHorror(false);
      // remove any quadrant focus
      focusQuadrant("none");
    }
    
    // QUADRANTS: alias for baseline (kept for semantic clarity)
    else if (scene === "quadrants") {
      hideMethodologyBtn();  // hide button for scatter scenes
      // restore from horror-zoom if coming back from that scene
      restoreFromHorrorZoom();
      
      // ensure scatter is drawn, then add quadrants
      if (mode !== "scatter") drawScatter();
      showFineNote();                      // scatter always shows the fine note
      addQuadrantsIfNeeded();              // overlay quadrant guides
      // unfocus horror if we're scrolling back from a horror scene
      if (isHorrorFocused) focusHorror(false);
      // remove any quadrant focus
      focusQuadrant("none");
    }
    
    // HIGH-VIEWS: highlight only genres above the mean views line
    else if (scene === "high-views") {
      hideMethodologyBtn();  // hide button for scatter scenes
      // restore from horror-zoom if coming back from that scene
      restoreFromHorrorZoom();
      
      // ensure scatter is present with quadrants
      if (mode !== "scatter") drawScatter();
      showFineNote();
      addQuadrantsIfNeeded();
      // remove horror focus if active
      if (isHorrorFocused) focusHorror(false);
      // apply high-views focus
      focusQuadrant("high-views");
    }
    
    // CRITICAL-DARLINGS: highlight only bottom-right quadrant (high rating, low views)
    else if (scene === "critical-darlings") {
      hideMethodologyBtn();  // hide button for scatter scenes
      // restore from horror-zoom if coming back from that scene
      restoreFromHorrorZoom();

      // ensure scatter is present with quadrants
      if (mode !== "scatter") drawScatter();
      showFineNote();
      addQuadrantsIfNeeded();
      
      // IMPORTANT: apply critical-darlings focus
      focusQuadrant("critical-darlings");
    }
    
    // HORROR: keep scatter + quadrants, but focus only on the horror bubble (cult corner)
    else if (scene === "horror") {
      hideMethodologyBtn();  // hide button for scatter scenes
      // restore from horror-zoom if coming back from that scene
      restoreFromHorrorZoom();

      // ensure scatter is present (in case we jumped directly to this card)
      if (mode !== "scatter") drawScatter();
      showFineNote();                      // scatter always shows the fine note
      addQuadrantsIfNeeded();              // ensure quadrants are visible

      // remove any previous quadrant focus first
      focusQuadrant("none");
      // use focusHorror to dim everything except horror AND update title
      focusHorror(true);
    }
    
    // HORROR-ZOOM: zoom into horror bubble, hide all others, make horror big and black
    else if (scene === "horror-zoom") {
      hideMethodologyBtn();  // hide button for scatter scenes
      // ensure scatter is present (in case we jumped directly to this card)
      if (mode !== "scatter") {
        drawScatter();
        addQuadrantsIfNeeded();
      }
      hideFineNote();                      // hide the fine note for this scene
      zoomToHorror();                      // apply the zoom effect
      // title is set by applyStepTitle() from data-title="Horror in the Hit Matrix"
    }
    
    // BARS: transition from scatter to the 14-category fear bar chart
    else if (scene === "bars") {
      showMethodologyBtn();  // show button for bar scenes
      // if already in bars mode, just remove any focus
      if (mode === "bars") {
        focusBars(null);  // remove any dimming
      } else {
        // fade out the current scatter layers (chart, axes, legend)
        // after fade completes, draw the bar chart, then fade it in
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();                    // draws 14-category bars, hides fine note
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);  // legend not needed for bars
        });
      }
    }
    
    // BARS_PSYCHOLOGICAL: focus on "Psychological & Domestic Horrors" supergroup
    else if (scene === "bars_psychological") {
      showMethodologyBtn();  // show button for bar scenes
      if (mode === "bars") {
        focusBarsBySupergroup("Psychological & Domestic Horrors");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(() => focusBarsBySupergroup("Psychological & Domestic Horrors"), 300);
        });
      }
    }
    
    // BARS_BODY: focus on "The Body as Battleground" supergroup
    else if (scene === "bars_body") {
      showMethodologyBtn();  // show button for bar scenes
      if (mode === "bars") {
        focusBarsBySupergroup("The Body as Battleground");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(() => focusBarsBySupergroup("The Body as Battleground"), 300);
        });
      }
    }
    
    // BARS_SOCIETAL: focus on "Societal & Structural Horrors" supergroup
    else if (scene === "bars_societal") {
      showMethodologyBtn();  // show button for bar scenes
      if (mode === "bars") {
        focusBarsBySupergroup("Societal & Structural Horrors");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(() => focusBarsBySupergroup("Societal & Structural Horrors"), 300);
        });
      }
    }
    
    // BARS_COSMIC: focus on "Cosmic & Moral Reckonings" supergroup
    else if (scene === "bars_cosmic") {
      showMethodologyBtn();  // show button for bar scenes
      if (mode === "bars") {
        focusBarsBySupergroup("Cosmic & Moral Reckonings");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(() => focusBarsBySupergroup("Cosmic & Moral Reckonings"), 300);
        });
      }
    }
    
    // NOOP: copy-only card—no visual change, keep current viz/legend/note state
    // useful for cards that provide narrative context without altering the chart
    else {
      // intentionally empty—do nothing
    }
  }



  /* ----------------------- scrollytelling engine -------------------------- */
  // this section orchestrates the scroll-driven narrative:
  // - the left column (chart) is sticky and remains in view
  // - the right column (text cards) scrolls past, each triggering a scene change
  // - we use IntersectionObserver to detect when the chart enters/exits the viewport
  // - we use scroll listeners to find which card is "active" (closest to viewport center)
  // - when a new card activates, we call go() with its data-scene attribute

  // collect all narrative steps (cards) on the right side
  const steps = Array.from(document.querySelectorAll(".step"));
  
  // "armed" = true when the sticky chart is visible; prevents scene changes when scrolled away
  let armed = false;
  
  // "active" = the currently active step element (the one triggering the current scene)
  let active = null;

  // reference to the sticky chart container (left column)
  const graphicEl = document.querySelector(".viz-wrap");
  
  // flag to ensure we only draw the initial scatter once, when the chart first enters view
  let baselineRendered = false;

  // IntersectionObserver watches the sticky chart container:
  // - when it first enters the viewport, draw the initial scatter (no quadrants yet)
  // - while it's in view (intersectionRatio >= 0.30), set armed = true
  // - when it leaves view, set armed = false (prevents unnecessary scene changes)
  new IntersectionObserver((entries) => {
    const e = entries[0];  // we're only observing one element, so take the first entry
    
    // on first intersection, render the baseline scatter chart (quadrants come later with first card)
    if (!baselineRendered && e.isIntersecting) {
      baselineRendered = true;             // flag prevents re-rendering on scroll up/down
      titleEl.text("The Hit Matrix");      // set initial title
    drawScatter();                       // clean scatter
    addQuadrantsIfNeeded();              // quadrant lines appear immediately with first card
    }
    
    // "armed" means: chart is visible enough (≥30%) to respond to card changes
    // this prevents scene changes when the chart is mostly/fully scrolled out of view
    armed = e.isIntersecting && e.intersectionRatio >= 0.30;
    
    // if we just became armed (chart entered view), immediately check which card is active
    if (armed) setActiveByCenter();
  }, { threshold: [0, 0.3, 1] }).observe(graphicEl);  // watch at 0%, 30%, and 100% visibility

  // core scrollytelling logic: find which card is closest to the viewport center,
  // and if it's different from the current active card, trigger its scene.
  // this function is called on scroll, resize, and when the chart becomes armed.
  function setActiveByCenter() {
    // bail out if the chart isn't in view—no point in changing scenes
    if (!armed) return;

    // the "activation line" is the vertical center of the viewport
    const mid = window.innerHeight / 2;
    
    // we'll loop through all cards and find the one whose center is nearest to mid
    let best = null, bestDist = Infinity;

    // check each narrative card to see which is closest to the viewport center
    steps.forEach(el => {
      const r = el.getBoundingClientRect();  // position relative to viewport
      
      // skip cards that are completely above or below the viewport
      if (r.bottom <= 0 || r.top >= window.innerHeight) return;
      
      // calculate the card's vertical center point
      const center = r.top + r.height / 2;
      
      // distance from this card's center to the viewport center
      const dist   = Math.abs(center - mid);
      
      // track the closest card so far
      if (dist < bestDist) { bestDist = dist; best = el; }
    });

    // if we found a closest card, and it's different from the current active card...
    if (best && best !== active) {
      // remove the visual highlight from the previously active card
      if (active) active.classList.remove("is-active");
      
      // update our reference to the new active card
      active = best;
      
      // add visual highlight to the newly active card (CSS can style .is-active)
      active.classList.add("is-active");

      // apply the card's metadata (title, subtitle, effects) before drawing
      applyStepTitle(active);               // update title if data-title is set
      applyStepSubtitle(active);            // update subtitle if data-subtitle is set
      applyStepFX(active);                  // reserved for future effects (data-fx)
      
      // finally, trigger the scene change by reading data-scene and calling go()
      // if no data-scene, default to "noop" (no visual change, copy-only card)
      go(active.getAttribute("data-scene") || "noop");
    }
  }

  // listen for scroll events: on every scroll, re-check which card is active
  // { passive: true } = performance optimization (we don't call preventDefault)
  window.addEventListener("scroll", setActiveByCenter, { passive: true });
  
  // on window resize, card positions shift—re-check which one should be active
  window.addEventListener("resize", setActiveByCenter);
  
  // initial check on page load (in case a card is already centered)
  setActiveByCenter();

  /* -------------------------- down-arrow link ----------------------------- */
 //   smooth-scroll on down-arrow click
  document.getElementById("to-graph")?.addEventListener("click", () => {
    const el = document.getElementById("graph");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* -------------------------- methodology modal ----------------------------- */
  const modal = document.getElementById("methodology-modal");
  const btn = document.getElementById("methodology-btn");
  const closeBtn = modal?.querySelector(".methodology-modal-close");
  const backdrop = modal?.querySelector(".methodology-modal-backdrop");

  btn?.addEventListener("click", () => modal?.classList.add("is-open"));
  closeBtn?.addEventListener("click", () => modal?.classList.remove("is-open"));
  backdrop?.addEventListener("click", () => modal?.classList.remove("is-open"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) {
      modal.classList.remove("is-open");
    }
  });
}

main();