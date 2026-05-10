const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const dataFiles = {
  hero: "data/hero.json",
  content: "data/content.json",
  social: "data/social.json",
};

const getValue = (data, path) => path.split(".").reduce((value, key) => value?.[key], data);

const setText = (element, value) => {
  if (typeof value === "string") element.textContent = value;
};

const renderList = (element, path, items) => {
  if (!Array.isArray(items)) return;

  if (path === "hero.schedule") {
    element.replaceChildren(...items.map(({ label, value }) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");

      term.textContent = label;
      detail.textContent = value;
      wrapper.append(term, detail);

      return wrapper;
    }));
    return;
  }

  if (path === "social.links") {
    element.replaceChildren(...items.map(({ label, url }) => {
      const link = document.createElement("a");

      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;

      return link;
    }));
    return;
  }

  element.replaceChildren(...items.map((item) => {
    const span = document.createElement("span");
    span.textContent = item;
    return span;
  }));
};

const loadPageData = async () => {
  try {
    const entries = await Promise.all(
      Object.entries(dataFiles).map(async ([key, url]) => [key, await fetch(url).then((response) => response.json())])
    );
    const data = Object.fromEntries(entries);

    document.querySelectorAll("[data-content]").forEach((element) => {
      setText(element, getValue(data, element.dataset.content));
    });

    document.querySelectorAll("[data-link]").forEach((element) => {
      const value = getValue(data, element.dataset.link);
      if (typeof value === "string") element.href = value;
    });

    document.querySelectorAll("[data-image]").forEach((element) => {
      const value = getValue(data, element.dataset.image);
      if (typeof value === "string") element.src = value;
    });

    document.querySelectorAll("[data-alt]").forEach((element) => {
      const value = getValue(data, element.dataset.alt);
      if (typeof value === "string") element.alt = value;
    });

    document.querySelectorAll("[data-label]").forEach((element) => {
      const value = getValue(data, element.dataset.label);
      if (typeof value === "string") element.setAttribute("aria-label", value);
    });

    document.querySelectorAll("[data-meta]").forEach((element) => {
      const value = getValue(data, `hero.meta.${element.dataset.meta}`);
      if (typeof value === "string") element.content = value;
    });

    if (data.hero?.meta?.documentTitle) document.title = data.hero.meta.documentTitle;

    document.querySelectorAll("[data-list]").forEach((element) => {
      renderList(element, element.dataset.list, getValue(data, element.dataset.list));
    });
  } catch (error) {
    console.warn("No se pudo cargar la data de la landing. Se usara el contenido HTML.", error);
  }
};

loadPageData();

const glow = document.querySelector(".cursor-glow");

if (glow && !reduceMotion) {
  let pointerFrame = 0;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight * 0.2;

  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;

    if (pointerFrame) return;

    pointerFrame = requestAnimationFrame(() => {
      glow.style.setProperty("--x", `${pointerX}px`);
      glow.style.setProperty("--y", `${pointerY}px`);
      pointerFrame = 0;
    });
  }, { passive: true });
}

const revealItems = document.querySelectorAll("[data-reveal]");

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10%", threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

document.querySelectorAll("[data-tilt]").forEach((card) => {
  if (reduceMotion) return;

  let tiltFrame = 0;
  let rect;
  let cursorX = 0;
  let cursorY = 0;

  card.addEventListener("pointermove", (event) => {
    rect = rect || card.getBoundingClientRect();
    cursorX = event.clientX;
    cursorY = event.clientY;

    if (tiltFrame) return;

    tiltFrame = requestAnimationFrame(() => {
      const x = (cursorX - rect.left) / rect.width - 0.5;
      const y = (cursorY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${-y * 4}deg) rotateY(${x * 5}deg) translateY(-3px)`;
      tiltFrame = 0;
    });
  }, { passive: true });

  card.addEventListener("pointerleave", () => {
    rect = null;
    card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)";
  });
});

const runner = document.querySelector("[data-runner]");

if (runner) {
  const player = runner.querySelector("[data-runner-player]");
  const obstacleLayer = runner.querySelector("[data-runner-obstacles]");
  const coinLayer = runner.querySelector("[data-runner-coins]");
  const scoreElement = runner.querySelector("[data-runner-score]");
  const statusElement = runner.querySelector("[data-runner-status]");
  const state = {
    active: false,
    crashed: false,
    lastTime: 0,
    nextSpawn: 0,
    nextCoin: 0,
    score: 0,
    speed: 260,
    velocityY: 0,
    y: 0,
    obstacles: [],
    coins: [],
    frame: 0,
  };
  const gravity = 1850;
  const jumpForce = 720;
  const groundY = 0;

  const setStatus = (message) => {
    if (statusElement) statusElement.textContent = message;
  };

  const setPlayerY = () => {
    player.style.setProperty("--runner-y", `${-state.y}px`);
  };

  const resetRunner = () => {
    state.active = false;
    state.crashed = false;
    state.lastTime = 0;
    state.nextSpawn = 0;
    state.nextCoin = 1200;
    state.score = 0;
    state.speed = 260;
    state.velocityY = 0;
    state.y = groundY;
    state.obstacles = [];
    state.coins = [];
    obstacleLayer.replaceChildren();
    coinLayer.replaceChildren();
    scoreElement.textContent = "0";
    setStatus("Click aqui");
    setPlayerY();
    runner.classList.remove("is-playing", "is-crashed");
  };

  const spawnObstacle = () => {
    const obstacle = document.createElement("span");
    const height = Math.random() > 0.58 ? 2 : 1;
    const gameWidth = runner.clientWidth;
    const obstacleState = {
      element: obstacle,
      x: gameWidth + 42,
      width: 34,
      height: height * 34,
      counted: false,
    };

    obstacle.className = `runner-block${height === 2 ? " runner-block--two" : ""}`;
    obstacle.style.setProperty("--runner-x", `${obstacleState.x}px`);
    obstacleLayer.append(obstacle);
    state.obstacles.push(obstacleState);
    state.nextSpawn = 760 + Math.random() * 780;
  };

  const spawnCoin = () => {
    const roll = Math.random();
    const type = roll > 0.9 ? "red" : roll > 0.72 ? "purple" : "yellow";
    const values = { yellow: 10, purple: 100, red: -50 };
    const coin = document.createElement("span");
    const coinState = {
      element: coin,
      x: runner.clientWidth + 44,
      y: 126 + Math.random() * 76,
      size: 34,
      value: values[type],
    };

    coin.className = `runner-coin runner-coin--${type}`;
    coin.style.setProperty("--runner-x", `${coinState.x}px`);
    coin.style.bottom = `${coinState.y}px`;
    coinLayer.append(coin);
    state.coins.push(coinState);
    state.nextCoin = 1100 + Math.random() * 2200;
  };

  const crash = () => {
    state.active = false;
    state.crashed = true;
    runner.classList.remove("is-playing");
    runner.classList.add("is-crashed");
    setStatus("Bloqueado, click reinicia");
  };

  const jump = () => {
    if (state.crashed) resetRunner();

    if (!state.active) {
      state.active = true;
      state.lastTime = performance.now();
      runner.classList.add("is-playing");
      setStatus("Espacio para saltar");
      state.frame = requestAnimationFrame(tick);
    }

    if (state.y <= groundY + 1) {
      state.velocityY = jumpForce;
    }
  };

  const hitTest = (obstacle) => {
    const playerLeft = runner.clientWidth * (window.innerWidth <= 560 ? 0.14 : 0.19) + 8;
    const playerRight = playerLeft + 44;
    const playerBottom = 78 + state.y;
    const playerTop = playerBottom + 82;
    const obstacleLeft = obstacle.x;
    const obstacleRight = obstacle.x + obstacle.width;
    const obstacleTop = 78 + obstacle.height;

    return playerRight > obstacleLeft && playerLeft < obstacleRight && playerBottom < obstacleTop && playerTop > 78;
  };

  const coinHitTest = (coin) => {
    const playerLeft = runner.clientWidth * (window.innerWidth <= 560 ? 0.14 : 0.19) + 7;
    const playerRight = playerLeft + 54;
    const playerBottom = 78 + state.y;
    const playerTop = playerBottom + 94;
    const coinLeft = coin.x;
    const coinRight = coin.x + coin.size;
    const coinBottom = coin.y;
    const coinTop = coin.y + coin.size;

    return playerRight > coinLeft && playerLeft < coinRight && playerTop > coinBottom && playerBottom < coinTop;
  };

  function tick(time) {
    if (!state.active) return;

    const delta = Math.min((time - state.lastTime) / 1000, 0.032);
    state.lastTime = time;
    state.score += delta * 10;
    state.speed = Math.min(430, state.speed + delta * 6);
    state.nextSpawn -= delta * 1000;
    state.nextCoin -= delta * 1000;

    state.velocityY -= gravity * delta;
    state.y = Math.max(groundY, state.y + state.velocityY * delta);

    if (state.y === groundY && state.velocityY < 0) state.velocityY = 0;

    if (state.nextSpawn <= 0) spawnObstacle();
    if (state.nextCoin <= 0) spawnCoin();

    state.obstacles.forEach((obstacle) => {
      obstacle.x -= state.speed * delta;
      obstacle.element.style.setProperty("--runner-x", `${obstacle.x}px`);

      if (!obstacle.counted && obstacle.x + obstacle.width < runner.clientWidth * 0.19) {
        obstacle.counted = true;
        state.score += 8;
      }
    });

    state.obstacles = state.obstacles.filter((obstacle) => {
      if (obstacle.x > -obstacle.width - 20) return true;
      obstacle.element.remove();
      return false;
    });

    state.coins.forEach((coin) => {
      coin.x -= state.speed * delta;
      coin.element.style.setProperty("--runner-x", `${coin.x}px`);
    });

    state.coins = state.coins.filter((coin) => {
      if (coinHitTest(coin)) {
        state.score = Math.max(0, state.score + coin.value);
        setStatus(`${coin.value > 0 ? "+" : ""}${coin.value} K`);
        coin.element.remove();
        return false;
      }

      if (coin.x > -coin.size - 20) return true;
      coin.element.remove();
      return false;
    });

    if (state.obstacles.some(hitTest)) {
      crash();
      return;
    }

    setPlayerY();
    scoreElement.textContent = Math.floor(state.score);
    state.frame = requestAnimationFrame(tick);
  }

  runner.addEventListener("click", jump);
  runner.addEventListener("touchstart", (event) => {
    event.preventDefault();
    jump();
  }, { passive: false });
  runner.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "ArrowUp") return;
    event.preventDefault();
    jump();
  });

  resetRunner();
}
