let sectorChartInstance = null;
let scopeChartInstance = null;
let venueChartInstance = null;
let visitorChartInstance = null;
let economicChartInstance = null;
let opportunityChartInstance = null;

function isValid(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return !["(to be supplemented)", "to be supplemented", "tbd", "n/a", "na", "-"].includes(v);
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function splitHotels(value) {
  if (!isValid(value)) return [];
  return String(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topEntries(obj, limit = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function renderTable(rows) {
  const tableBody = document.getElementById("tableBody");
  if (!tableBody) return;

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5">No matching events found.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows.slice(0, 100).map((e) => `
    <tr>
      <td>${isValid(e.title) ? e.title : "—"}</td>
      <td>${isValid(e.venue) ? e.venue : "—"}</td>
      <td>${isValid(e.sector) ? e.sector : "—"}</td>
      <td>${isValid(e.scope) ? e.scope : "—"}</td>
      <td>${e.impact > 0 ? e.impact.toLocaleString() : "—"}</td>
    </tr>
  `).join("");
}

function makeBarChart(canvasId, labels, data, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 42
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function buildData(events) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const sectorCount = {};
  const scopeCount = {};
  const venueCount = {};
  const visitorBySector = {};
  const economicByVenue = {};

  const enrichedEvents = events.map((e) => {
    const impact = parseNumber(e["visitor impact"]) || parseNumber(e.size);
    const economicIntensity = parseNumber(e["Economicintensity"]);
    const hotelList = splitHotels(e["nearby hotel"]);
    const hotelCount = parseNumber(e["hotel count "]) || parseNumber(e["hotel count"]) || hotelList.length;
    const opportunityScore = parseNumber(e["Final Opportunity Score"]);
    const estimatedRestaurant = parseNumber(e["estimated restaurant"]);
    const estimatedStores = parseNumber(e["estimated merchants/stores"]);
    const startDate = safeDate(e.start);

    if (isValid(e.sector)) {
      sectorCount[e.sector] = (sectorCount[e.sector] || 0) + 1;
      visitorBySector[e.sector] = (visitorBySector[e.sector] || 0) + impact;
    }

    if (isValid(e.scope)) {
      scopeCount[e.scope] = (scopeCount[e.scope] || 0) + 1;
    }

    if (isValid(e.venue)) {
      venueCount[e.venue] = (venueCount[e.venue] || 0) + 1;

      if (economicIntensity > 0) {
        economicByVenue[e.venue] = Math.max(economicByVenue[e.venue] || 0, economicIntensity);
      }
    }

    return {
      ...e,
      startDate,
      impact,
      economicIntensity,
      hotelList,
      hotelCount,
      opportunityScore,
      estimatedRestaurant,
      estimatedStores
    };
  });

  const totalEvents = enrichedEvents.length;
  const thisMonthEvents = enrichedEvents.filter((e) => (
    e.startDate &&
    e.startDate.getMonth() === currentMonth &&
    e.startDate.getFullYear() === currentYear
  ));

  const thisMonth = thisMonthEvents.length;
  const upcoming = enrichedEvents.filter((e) => e.startDate && e.startDate > now).length;

  const sectorSet = new Set(
    enrichedEvents.map((e) => (isValid(e.sector) ? e.sector.trim() : "")).filter(Boolean)
  );

  const thisMonthHotelCounts = {};
  const thisMonthVenueCounts = {};
  let thisMonthRestaurantImpact = 0;
  let thisMonthStoreImpact = 0;
  let thisMonthVisitorImpact = 0;

  thisMonthEvents.forEach((e) => {
    thisMonthVisitorImpact += e.impact;
    thisMonthRestaurantImpact += e.estimatedRestaurant;
    thisMonthStoreImpact += e.estimatedStores;

    if (isValid(e.venue)) {
      thisMonthVenueCounts[e.venue] = (thisMonthVenueCounts[e.venue] || 0) + 1;
    }

    e.hotelList.forEach((hotel) => {
      thisMonthHotelCounts[hotel] = (thisMonthHotelCounts[hotel] || 0) + 1;
    });
  });

  return {
    totalEvents,
    thisMonth,
    upcoming,
    sectors: sectorSet.size,
    sectorEntries: topEntries(sectorCount, 10),
    scopeEntries: topEntries(scopeCount, 10),
    venueEntries: topEntries(venueCount, 5),
    visitorEntries: topEntries(visitorBySector, 5),
    economicEntries: topEntries(economicByVenue, 5),
    opportunityEvents: enrichedEvents
      .filter((e) => e.opportunityScore > 0 && isValid(e.title))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5),
    thisMonthSummary: {
      eventCount: thisMonthEvents.length,
      uniqueHotels: Object.keys(thisMonthHotelCounts).length,
      visitorImpact: thisMonthVisitorImpact,
      restaurantImpact: thisMonthRestaurantImpact,
      storeImpact: thisMonthStoreImpact,
      topVenue: topEntries(thisMonthVenueCounts, 1)[0] || null,
      hotelEntries: topEntries(thisMonthHotelCounts, 6),
      events: thisMonthEvents
        .slice()
        .sort((a, b) => a.startDate - b.startDate)
        .map((e) => ({
          title: e.title,
          venue: e.venue,
          start: e.start,
          end: e.end,
          hotels: e.hotelList
        }))
    },
    enrichedEvents
  };
}

function renderStats(summary) {
  setText("totalEvents", summary.totalEvents);
  setText("thisMonth", summary.thisMonth);
  setText("upcoming", summary.upcoming);
  setText("sectors", summary.sectors);
}

function renderSectorChart(sectorEntries) {
  const canvas = document.getElementById("sectorChart");
  if (!canvas) return;

  if (sectorChartInstance) sectorChartInstance.destroy();

  const total = sectorEntries.reduce((sum, [, value]) => sum + value, 0);
  const labels = sectorEntries.map(([name, value]) => {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `${name} (${pct}%)`;
  });

  sectorChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: sectorEntries.map(([, value]) => value),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top"
        }
      }
    }
  });
}

function renderScopeChart(scopeEntries) {
  const canvas = document.getElementById("scopeChart");
  if (!canvas) return;

  if (scopeChartInstance) scopeChartInstance.destroy();

  scopeChartInstance = makeBarChart(
    "scopeChart",
    scopeEntries.map(([k]) => k),
    scopeEntries.map(([, v]) => v),
    "Events"
  );
}

function renderVenueChart(venueEntries) {
  const canvas = document.getElementById("venueChart");
  if (!canvas) return;

  if (venueChartInstance) venueChartInstance.destroy();

  venueChartInstance = makeBarChart(
    "venueChart",
    venueEntries.map(([k]) => k),
    venueEntries.map(([, v]) => v),
    "Events"
  );
}

function renderVisitorChart(visitorEntries) {
  const canvas = document.getElementById("visitorChart");
  if (!canvas) return;

  if (visitorChartInstance) visitorChartInstance.destroy();

  visitorChartInstance = makeBarChart(
    "visitorChart",
    visitorEntries.map(([k]) => k),
    visitorEntries.map(([, v]) => v),
    "Visitor Impact"
  );
}

function renderSearchableTable(enrichedEvents) {
  const sorted = enrichedEvents
    .filter((e) => e.impact > 0 || isValid(e.title) || isValid(e.venue))
    .sort((a, b) => b.impact - a.impact);

  renderTable(sorted);

  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (event) => {
    const keyword = event.target.value.toLowerCase().trim();

    const filtered = sorted.filter((e) =>
      [e.title, e.venue, e.sector, e.scope]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(keyword))
    );

    renderTable(filtered);
  });
}

function renderEconomicChart(economicEntries) {
  const canvas = document.getElementById("economicChart");
  if (!canvas) return;

  if (economicChartInstance) economicChartInstance.destroy();

  economicChartInstance = makeBarChart(
    "economicChart",
    economicEntries.map(([k]) => k),
    economicEntries.map(([, v]) => v),
    "Economic Intensity"
  );
}

function renderOpportunityChart(opportunityEvents) {
  const canvas = document.getElementById("opportunityChart");
  if (!canvas) return;

  if (opportunityChartInstance) opportunityChartInstance.destroy();

  opportunityChartInstance = makeBarChart(
    "opportunityChart",
    opportunityEvents.map((e) => e.title),
    opportunityEvents.map((e) => e.opportunityScore),
    "Final Opportunity Score"
  );
}

function renderAnalyticsHighlights(thisMonthSummary) {
  setText("monthEventCount", thisMonthSummary.eventCount);
  setText("monthHotelCount", thisMonthSummary.uniqueHotels);
  setText("monthVisitorImpact", thisMonthSummary.visitorImpact.toLocaleString());
  setText("monthVenueLead", thisMonthSummary.topVenue ? thisMonthSummary.topVenue[0] : "—");
  setText("monthRestaurantImpact", thisMonthSummary.restaurantImpact.toLocaleString());
  setText("monthStoreImpact", thisMonthSummary.storeImpact.toLocaleString());

  const hotelList = document.getElementById("monthlyHotelList");
  if (hotelList) {
    if (!thisMonthSummary.hotelEntries.length) {
      hotelList.innerHTML = `<li>No nearby hotel data available for this month.</li>`;
    } else {
      hotelList.innerHTML = thisMonthSummary.hotelEntries
        .map(([hotel, count]) => `<li><strong>${hotel}</strong><span>${count} event${count > 1 ? "s" : ""}</span></li>`)
        .join("");
    }
  }

  const eventList = document.getElementById("monthlyEventList");
  if (eventList) {
    if (!thisMonthSummary.events.length) {
      eventList.innerHTML = `<li>No events scheduled for this month.</li>`;
    } else {
      eventList.innerHTML = thisMonthSummary.events
        .map((event) => `
          <li>
            <strong>${isValid(event.title) ? event.title : "Untitled Event"}</strong>
            <span>${isValid(event.venue) ? event.venue : "Venue TBC"}</span>
            <em>${isValid(event.start) ? event.start : "Date TBC"}${isValid(event.end) && event.end !== event.start ? ` to ${event.end}` : ""}</em>
          </li>
        `)
        .join("");
    }
  }
}

fetch("data.json")
  .then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load data.json: ${res.status}`);
    }
    return res.json();
  })
  .then((events) => {
    const page = document.body.dataset.page;
    const summary = buildData(events);

    if (page === "home") {
      renderStats(summary);
      renderSectorChart(summary.sectorEntries);
      renderScopeChart(summary.scopeEntries);
    }

    if (page === "analytics") {
      renderSectorChart(summary.sectorEntries);
      renderScopeChart(summary.scopeEntries);
      renderVenueChart(summary.venueEntries);
      renderVisitorChart(summary.visitorEntries);
      renderEconomicChart(summary.economicEntries);
      renderOpportunityChart(summary.opportunityEvents);
      renderAnalyticsHighlights(summary.thisMonthSummary);
    }

    if (page === "data") {
      renderSearchableTable(summary.enrichedEvents);
    }
  })
  .catch((error) => {
    console.error(error);
    setText("totalEvents", "0");
    setText("thisMonth", "0");
    setText("upcoming", "0");
    setText("sectors", "0");

    const tableBody = document.getElementById("tableBody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5">Failed to load dashboard data.</td>
        </tr>
      `;
    }
  });
