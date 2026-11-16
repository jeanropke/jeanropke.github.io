const maps = [
  {
    title: "Collectors map",
    description: "Collectors map for Red Dead Online.",
    url: "https://jeanropke.github.io/RDR2CollectorsMap/",
    image: new URL("./assets/images/headers/rdocollectors.jpg", import.meta.url).href
  },
  {
    title: "RDO Map",
    description: "Map for Red Dead Online and Story Mode.",
    url: "https://jeanropke.github.io/RDOMap/",
    image: new URL("./assets/images/headers/rdr2_rdo.jpg", import.meta.url).href
  },
  {
    title: "Mad Max Map",
    description: "Explore the Wasteland and use the save reader to import your Mad Max save file and track your progress.",
    url: "https://jeanropke.github.io/MadMaxMap/",
    image: new URL("./assets/images/headers/madmax.jpg", import.meta.url).href
  },
  {
    title: "GTA V Map",
    description: "Explore Los Santos and Blaine County, find collectibles and activities, plan routes, and use the save reader to import your GTA V save file and track your progress.",
    url: "https://jeanropke.github.io/GTAVMap/",
    image: new URL("./assets/images/headers/gtav.png", import.meta.url).href
  },
  {
    title: "GTA Online Map",
    description: "Explore Los Santos and Cayo Perico, find collectibles and activities, plan routes, and track your progress with personal markers and checklists.",
    url: "https://jeanropke.github.io/GTAOMap/",
    image: new URL("./assets/images/headers/gtao.png", import.meta.url).href
  },
  {
    title: "Red Dead Redemption Map",
    description: "Explore Red Dead Redemption and Undead Nightmare, and import a supported save to track missions, Stranger tasks and treasure hunts.",
    url: "https://jeanropke.github.io/RDRMap/",
    image: new URL("./assets/images/headers/rdr.png", import.meta.url).href
  },
  {
    title: "L.A. Noire Map",
    description: "Explore Los Angeles, find collectibles and case locations, and import a supported save to track your progress. Includes Remastered collectibles.",
    url: "https://jeanropke.github.io/LANoireMap/",
    image: new URL("./assets/images/headers/lanoire.png", import.meta.url).href
  },
  {
    title: "GTA IV Map",
    description: "Explore Liberty City and use the save reader to import your GTA IV save file and see what you still need to complete.",
    url: "https://jeanropke.github.io/GTAIVMap/",
    image: new URL("./assets/images/headers/gtaiv.jpg", import.meta.url).href
  },
  {
    title: "GTA San Andreas Map",
    description: "Explore San Andreas and use the save reader to import your save file, track your progress, and find what you still need to complete.",
    url: "https://jeanropke.github.io/GTASAMap/",
    image: new URL("./assets/images/headers/gtasa.jpg", import.meta.url).href
  },
  {
    title: "GTA Vice City Map",
    description: "Explore Vice City and use the save reader to import your save file, track your progress, and find what you still need to complete.",
    url: "https://jeanropke.github.io/GTAVCMap/",
    image: new URL("./assets/images/headers/gtavc.jpg", import.meta.url).href
  },
  {
    title: "GTA III Map",
    description: "Explore Liberty City and use the save reader to import your GTA III save file and see what you still need to complete.",
    url: "https://jeanropke.github.io/GTAIIIMap/",
    image: new URL("./assets/images/headers/gtaiii.jpg", import.meta.url).href
  },
  {
    title: "GTA Vice City Stories Map",
    description: "Revisit Vice City in 1984 and use the save reader to import your Vice City Stories save file and track your progress.",
    url: "https://jeanropke.github.io/GTAVCSMap/",
    image: new URL("./assets/images/headers/gtavcs.jpg", import.meta.url).href
  },
  {
    title: "GTA Liberty City Stories Map",
    description: "Revisit Liberty City in 1998 and use the save reader to import your Liberty City Stories save file and track your progress.",
    url: "https://jeanropke.github.io/GTALCSMap/",
    image: new URL("./assets/images/headers/gtalcs.jpg", import.meta.url).href
  },
  {
    title: "GTA Chinatown Wars Map",
    description: "Explore Liberty City and use the save reader to import your GTA Chinatown Wars save file and track your progress.",
    url: "https://jeanropke.github.io/GTACTWMap/",
    image: new URL("./assets/images/headers/gtactw.jpg", import.meta.url).href
  },
  {
    title: "Fallout 76 Map",
    description: "Interactive map for Fallout 76.",
    url: "https://jeanropke.github.io/FO76Map/",
    image: new URL("./assets/images/headers/fallout76.jpg", import.meta.url).href
  }
];

const grid = document.querySelector("#map-grid");

function renderMaps() {
  grid.innerHTML = maps.map((map) => {
    const disabled = map.url === "#";
    const tag = disabled ? "article" : "a";
    const href = disabled ? "" : ` href="${map.url}"`;
    const action = disabled ? "Coming soon" : "Open map";
    const image = map.image
      ? `<img class="map-image" src="${map.image}" alt="">`
      : "";

    return `
      <${tag} class="map-card"${href} aria-label="${map.title}">
        <div class="map-media">
          ${image}
        </div>
        <div class="map-card-content">
          <h2 class="map-title">${map.title}</h2>
          <p class="map-description">${map.description}</p>
          <span class="map-action">${action}</span>
        </div>
      </${tag}>
    `;
  }).join("");

  document.querySelector("#map-count").textContent = `${maps.length} maps`;
}

renderMaps();
