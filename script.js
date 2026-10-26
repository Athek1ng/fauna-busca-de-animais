const API_URL = "https://api.inaturalist.org/v1/taxa";
const animalGrid = document.querySelector("#animal-grid");
const searchInput = document.querySelector("#animal-search");
const refreshButton = document.querySelector("#refresh-button");
const statusMessage = document.querySelector("#status-message");
const resultCount = document.querySelector("#result-count");
const categoryGrid = document.querySelector("#category-grid");
const selectedGroupTitle = document.querySelector("#selected-group-title");
const groupSearchInput = document.querySelector("#group-search");

let animais = [];
let paginaAtual = 1;
let timerBusca;
let requisicaoAtual = 0;
let grupoSelecionado = null;

function criarTexto(tag, className, texto) {
  const elemento = document.createElement(tag);
  elemento.className = className;
  elemento.textContent = texto || "Não informado";
  return elemento;
}

function renderizarAnimais(lista) {
  animalGrid.replaceChildren();
  resultCount.textContent = `${lista.length} ${lista.length === 1 ? "espécie" : "espécies"}`;

  if (lista.length === 0) {
    statusMessage.textContent = "Nenhum animal encontrado. Tente outro termo.";
    statusMessage.hidden = false;
    return;
  }

  statusMessage.hidden = true;

  lista.forEach((animal) => {
    const card = document.createElement("article");
    card.className = "animal-card";

    const imageFrame = document.createElement("div");
    imageFrame.className = "animal-image-frame";

    const photo = animal.default_photo;
    if (photo?.medium_url) {
      const image = document.createElement("img");
      image.className = "animal-image";
      image.src = photo.medium_url;
      image.alt = `Imagem de ${animal.preferred_common_name || animal.name}`;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        imageFrame.classList.add("image-unavailable");
        image.remove();
      }, { once: true });
      imageFrame.append(image);

      if (photo.attribution) {
        const credit = criarTexto("span", "image-credit", `Foto: ${photo.attribution}`);
        credit.title = photo.attribution;
        imageFrame.append(credit);
      }
    } else {
      imageFrame.classList.add("image-unavailable");
    }

    const content = document.createElement("div");
    content.className = "animal-content";
    content.append(
      criarTexto("p", "animal-type", animal.iconic_taxon_name),
      criarTexto("h3", "animal-name", animal.preferred_common_name || animal.name),
      criarTexto("p", "animal-latin", animal.name)
    );

    const details = document.createElement("dl");
    details.className = "animal-details";
    [["Classificação", animal.iconic_taxon_name], ["Registros", animal.observations_count?.toLocaleString("pt-BR")]].forEach(([label, value]) => {
      const item = document.createElement("div");
      const term = criarTexto("dt", "detail-label", label);
      const description = criarTexto("dd", "detail-value", value);
      item.append(term, description);
      details.append(item);
    });

    const speciesLink = document.createElement("a");
    speciesLink.className = "species-link";
    speciesLink.href = `https://www.inaturalist.org/taxa/${animal.id}`;
    speciesLink.target = "_blank";
    speciesLink.rel = "noreferrer";
    speciesLink.textContent = "Ver espécie";

    content.append(details, speciesLink);
    card.append(imageFrame, content);
    animalGrid.append(card);
  });
}

async function buscarAnimais() {
  const numeroRequisicao = ++requisicaoAtual;
  const parametros = new URLSearchParams({
    taxon_id: "1",
    rank: "species",
    per_page: "9",
    page: String(paginaAtual),
    locale: "pt-BR",
    order: "desc",
    order_by: "observations_count"
  });
  const campoBusca = grupoSelecionado ? groupSearchInput : searchInput;
  const termo = campoBusca?.value.trim() || "";
  if (termo) parametros.set("q", termo);

  if (grupoSelecionado) parametros.set("taxon_id", grupoSelecionado.id);

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.classList.add("is-loading");
  }
  statusMessage.hidden = false;
  statusMessage.textContent = termo
    ? `Procurando por “${termo}”...`
    : `Carregando espécies${grupoSelecionado ? ` de ${grupoSelecionado.name.toLowerCase()}` : ""}...`;

  try {
    const resposta = await fetch(`${API_URL}?${parametros}`);
    if (!resposta.ok) {
      throw new Error(`A API respondeu com o status ${resposta.status}`);
    }

    const resultado = await resposta.json();
    if (numeroRequisicao !== requisicaoAtual) return;
    animais = paginaAtual > 1 ? [...animais, ...(resultado.results || [])] : resultado.results || [];
    renderizarAnimais(animais);
  } catch (erro) {
    if (numeroRequisicao !== requisicaoAtual) return;
    console.error("Erro ao buscar dados da API:", erro);
    animalGrid.replaceChildren();
    resultCount.textContent = "";
    statusMessage.textContent = "Não foi possível carregar os animais. Verifique sua conexão e tente novamente.";
    statusMessage.hidden = false;
  } finally {
    if (numeroRequisicao === requisicaoAtual && refreshButton) {
      refreshButton.disabled = false;
      refreshButton.classList.remove("is-loading");
    }
  }
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    window.clearTimeout(timerBusca);
    paginaAtual = 1;
    timerBusca = window.setTimeout(buscarAnimais, 300);
  });
}

if (refreshButton) {
  refreshButton.addEventListener("click", () => {
    paginaAtual += 1;
    buscarAnimais();
  });
}

if (categoryGrid) {
  groupSearchInput.addEventListener("input", () => {
    window.clearTimeout(timerBusca);
    paginaAtual = 1;
    timerBusca = window.setTimeout(buscarAnimais, 300);
  });

  categoryGrid.addEventListener("click", (event) => {
    const botao = event.target.closest(".category-card");
    if (!botao) return;

    grupoSelecionado = { id: botao.dataset.taxonId, name: botao.dataset.groupName };
    paginaAtual = 1;
    groupSearchInput.value = "";
    groupSearchInput.disabled = false;
    groupSearchInput.placeholder = `Buscar em ${grupoSelecionado.name}...`;
    categoryGrid.querySelectorAll(".category-card").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === botao));
    });
    selectedGroupTitle.textContent = `Espécies de ${grupoSelecionado.name}`;
    buscarAnimais();
    document.querySelector("#results-section").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (searchInput) buscarAnimais();