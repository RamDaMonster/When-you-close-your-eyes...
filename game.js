const clinicMap = [
    "##############",
    "#SE...#....A.#",
    "#.##.#.####..#",
    "#....#....#..#",
    "#.######.#.#.#",
    "#...1....#...#",
    "#.#####.###..#",
    "#L....#....#B#",
    "#.###.#.##.#.#",
    "#C..#..L.#...#",
    "#..2.....#.3.#",
    "##############"
];

const directions = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    W: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    S: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    A: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    D: { x: 1, y: 0 }
};

const attendantSteps = [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
];

const ECHO_LIMIT = 3;
const WARD_LIGHT_TURNS = 4;

const anchorInfo = {
    "1": {
        label: "CHILDREN'S WARD",
        title: "The music box",
        message:
            "Theo's music box is still warm. You used to wind it until he finally slept. Tonight, its melody stops after only three notes."
    },
    "2": {
        label: "RECORDS ARCHIVE",
        title: "The note",
        message:
            "Your handwriting fills the margins: \"If he closes his eyes, do not let him walk alone.\" You do not remember writing it."
    },
    "3": {
        label: "SLEEP LAB",
        title: "The recording",
        message:
            "The recorder clicks on. Theo whispers, \"Wake the anchors, Mara.\" Then another voice answers from somewhere much closer."
    }
};

const attendantInfo = [
    {
        id: "attendant",
        marker: "A",
        name: "The Attendant",
        className: "attendant-a",
        sound: "attendant-a",
        story: "A figure in a white uniform takes its first step in the Foyer."
    },
    {
        id: "echo",
        marker: "B",
        name: "The Echo",
        className: "attendant-b",
        sound: "attendant-b",
        story: "Something begins walking the route you already left behind."
    },
    {
        id: "matron",
        marker: "C",
        name: "The Matron",
        className: "attendant-c",
        sound: "attendant-c",
        story: "The Matron opens her eyes. The front door is no longer close."
    }
];

const gameBoard = document.querySelector("#game-board");
const anchorCount = document.querySelector("#anchor-count");
const messageLabel = document.querySelector("#message-label");
const messageText = document.querySelector("#message-text");
const objectiveText = document.querySelector("#objective-text");
const threatText = document.querySelector("#threat-text");
const statusText = document.querySelector("#status-text");
const stepCount = document.querySelector("#step-count");
const roomName = document.querySelector("#room-name");
const storyPopup = document.querySelector("#story-popup");
const storyKicker = document.querySelector("#story-kicker");
const storyTitle = document.querySelector("#story-title");
const storyText = document.querySelector("#story-text");
const continueButton = document.querySelector("#continue-button");

let player = findTile("S");
let attendants = createAttendants();
let foundAnchors = new Set();
let foundWardLights = new Set();
let visitedTiles = new Set();
let movementHistory = [];
let lastDirection = null;
let moveCount = 0;
let echoCount = 0;
let wardLightTurns = 0;
let gameFinished = false;
let storyOpen = false;
let storyAction = "close";
let soundEnabled = true;
let audioContext;

function createAttendants() {
    return attendantInfo.map((info) => ({
        ...info,
        position: findTile(info.marker),
        active: false,
        clock: 0
    }));
}

function findTile(tile) {
    for (let y = 0; y < clinicMap.length; y += 1) {
        for (let x = 0; x < clinicMap[y].length; x += 1) {
            if (clinicMap[y][x] === tile) {
                return { x, y };
            }
        }
    }

    return null;
}

function samePosition(first, second) {
    return first.x === second.x && first.y === second.y;
}

function positionKey(position) {
    return `${position.x},${position.y}`;
}

function tileAt(x, y) {
    if (y < 0 || y >= clinicMap.length || x < 0 || x >= clinicMap[y].length) {
        return "#";
    }

    return clinicMap[y][x];
}

function isWalkable(x, y) {
    return tileAt(x, y) !== "#";
}

function activeAttendants() {
    return attendants.filter((attendant) => attendant.active);
}

function renderMap() {
    gameBoard.innerHTML = "";
    gameBoard.style.gridTemplateColumns = `repeat(${clinicMap[0].length}, 1fr)`;

    for (let y = 0; y < clinicMap.length; y += 1) {
        for (let x = 0; x < clinicMap[y].length; x += 1) {
            const mapTile = clinicMap[y][x];
            const position = { x, y };
            const tile = document.createElement("div");

            tile.classList.add("tile");
            tile.classList.add(mapTile === "#" ? "wall" : "floor");

            if (mapTile === "1" && !foundAnchors.has("1")) {
                tile.classList.add("anchor", "music-box");
            }

            if (mapTile === "2" && !foundAnchors.has("2")) {
                tile.classList.add("anchor", "note");
            }

            if (mapTile === "3" && !foundAnchors.has("3")) {
                tile.classList.add("anchor", "recording");
            }

            if (mapTile === "L" && !foundWardLights.has(positionKey(position))) {
                tile.classList.add("ward-light");
            }

            if (mapTile === "E") {
                tile.classList.add("exit");

                if (foundAnchors.size === 3) {
                    tile.classList.add("unlocked");
                }
            }

            const attendant = activeAttendants().find((enemy) =>
                samePosition(enemy.position, position)
            );

            if (attendant) {
                tile.classList.add("attendant", attendant.className);
            }

            if (samePosition(player, position)) {
                tile.classList.add("player");
            }

            gameBoard.appendChild(tile);
        }
    }
}

function updateInterface() {
    const awake = activeAttendants();

    anchorCount.textContent = `${foundAnchors.size} / 3`;
    stepCount.textContent = moveCount;
    roomName.textContent = `Current room: ${getRoomName()}`;

    if (gameFinished) {
        objectiveText.textContent = "The story is over. Press R to play again.";
    } else if (foundAnchors.size === 3) {
        objectiveText.textContent =
            "The front door is unlocked. Reach it before the halls close in.";
    } else {
        const remaining = 3 - foundAnchors.size;
        objectiveText.textContent = `Wake Theo's anchors. ${remaining} remaining.`;
    }

    if (awake.length === 0) {
        threatText.textContent =
            "Dormant.\nEvery anchor wakes another presence.";
        return;
    }

    const pace = awake
        .map((attendant) =>
            `${attendant.name}: ${getAttendantMoveEvery(attendant)} steps`
        )
        .join(" | ");

    const protection = wardLightTurns > 0
        ? `Ward light active: ${wardLightTurns} moves`
        : `Echo trail: ${echoCount} / ${ECHO_LIMIT}`;

    threatText.textContent =
        `Awake: ${awake.length}/3\n${pace}\n${protection}`;
}

function getAttendantMoveEvery(attendant) {
    if (attendant.id === "attendant") {
        if (foundAnchors.size === 1) {
            return 4;
        }

        if (foundAnchors.size === 2) {
            return 3;
        }

        return 2;
    }

    return 4;
}

function getRoomName() {
    if (player.y <= 3) {
        return "Foyer";
    }

    if (player.y <= 6 && player.x <= 7) {
        return "Children's Ward";
    }

    if (player.y >= 8 && player.x <= 8) {
        return "Records Archive";
    }

    return "Sleep Lab";
}

function showStory(kicker, title, message, buttonLabel = "Continue", action = "close") {
    storyOpen = true;
    storyAction = action;
    storyKicker.textContent = kicker;
    storyTitle.textContent = title;
    storyText.textContent = message;
    continueButton.textContent = buttonLabel;
    storyPopup.hidden = false;
    continueButton.focus();
}

function closeStory() {
    storyOpen = false;
    storyAction = "close";
    storyPopup.hidden = true;
    statusText.textContent = "Choose a route. Ward lights buy time, but only once.";
}

function handleContinue() {
    if (storyAction === "restart") {
        resetGame();
        return;
    }

    closeStory();
}

function movePlayer(direction) {
    if (storyOpen || gameFinished) {
        return;
    }

    const next = {
        x: player.x + direction.x,
        y: player.y + direction.y
    };

    if (!isWalkable(next.x, next.y)) {
        statusText.textContent = "That corridor is blocked.";
        return;
    }

    if (activeAttendants().some((attendant) => samePosition(next, attendant.position))) {
        player = next;
        loseGame("Mara steps into an Attendant's shadow.");
        return;
    }

    const nextTile = tileAt(next.x, next.y);

    if (nextTile === "E" && foundAnchors.size < 3) {
        statusText.textContent =
            "The front door is locked. Wake all three anchors first.";
        return;
    }

    player = next;
    lastDirection = direction;
    movementHistory.push({ ...player });

    if (movementHistory.length > 7) {
        movementHistory.shift();
    }

    const repeatedTile = visitedTiles.has(positionKey(player));
    visitedTiles.add(positionKey(player));
    moveCount += 1;
    playSound("step");

    if (anchorInfo[nextTile] && !foundAnchors.has(nextTile)) {
        collectAnchor(nextTile);
        return;
    }

    if (nextTile === "E") {
        finishGame();
        return;
    }

    if (nextTile === "L" && !foundWardLights.has(positionKey(player))) {
        collectWardLight();
        renderMap();
        updateInterface();
        return;
    }

    const echoMessage = recordFootstep(repeatedTile);

    if (gameFinished) {
        return;
    }

    const attendantMessage = advanceAttendants();

    if (!gameFinished) {
        statusText.textContent =
            echoMessage ||
            attendantMessage ||
            "The clinic listens to Mara's footsteps.";

        renderMap();
        updateInterface();
    }
}

function collectAnchor(anchorNumber) {
    const anchor = anchorInfo[anchorNumber];
    const newlyAwake = wakeNextAttendant();

    foundAnchors.add(anchorNumber);
    visitedTiles = new Set([positionKey(player)]);
    movementHistory = [{ ...player }];
    echoCount = 0;

    messageLabel.textContent = `${anchor.label} - WAKE ANCHOR`;
    messageText.textContent = anchor.message;

    playSound("anchor");
    renderMap();
    updateInterface();

    const wakeMessage = newlyAwake
        ? `\n\n${newlyAwake.story}`
        : "";

    if (foundAnchors.size === 3) {
        statusText.textContent =
            "The front door unlocks somewhere far above.";

        showStory(
            "THIRD WAKE ANCHOR",
            anchor.title,
            `${anchor.message}${wakeMessage}\n\nAll three presences are awake. Get back to the front door.`,
            "Run"
        );

        return;
    }

    statusText.textContent =
        "A memory surfaces. The clinic is no longer empty.";

    showStory(
        `THEO'S MEMORY - ${foundAnchors.size} OF 3`,
        anchor.title,
        `${anchor.message}${wakeMessage}`
    );
}

function wakeNextAttendant() {
    const nextAttendant = attendants[foundAnchors.size];

    if (!nextAttendant) {
        return null;
    }

    nextAttendant.active = true;
    nextAttendant.clock = 0;
    nextAttendant.position = findTile(nextAttendant.marker);

    return nextAttendant;
}

function collectWardLight() {
    foundWardLights.add(positionKey(player));
    wardLightTurns = WARD_LIGHT_TURNS;
    echoCount = 0;

    flashBoard("ward-light-warning");
    playSound("ward-light");

    statusText.textContent =
        "A ward light flares. The Attendants cannot move for four steps.";
}

function recordFootstep(repeatedTile) {
    if (activeAttendants().length === 0 || !repeatedTile) {
        return "";
    }

    if (wardLightTurns > 0) {
        echoCount = 0;
        return "";
    }

    echoCount += 1;

    if (echoCount < ECHO_LIMIT) {
        playSound("echo");
        return `Your footsteps repeat. Echo trail ${echoCount}/${ECHO_LIMIT}.`;
    }

    echoCount = 0;
    flashBoard("echo-warning");
    playSound("echo-burst");

    const moved = rushAttendants();

    if (gameFinished) {
        return "";
    }

    return moved
        ? "The clinic remembers your route. Every Attendant moves early."
        : "The echo fades into a locked corridor.";
}

function rushAttendants() {
    let moved = false;

    for (const attendant of activeAttendants()) {
        moved = moveOneAttendant(attendant) || moved;

        if (gameFinished) {
            return moved;
        }
    }

    return moved;
}

function advanceAttendants() {
    const awake = activeAttendants();

    if (awake.length === 0 || gameFinished) {
        return "";
    }

    if (wardLightTurns > 0) {
        wardLightTurns -= 1;

        return wardLightTurns > 0
            ? `The ward light holds for ${wardLightTurns} more moves.`
            : "The ward light goes dark.";
    }

    let moved = false;

    for (const attendant of awake) {
        attendant.clock += 1;

        if (attendant.clock % getAttendantMoveEvery(attendant) === 0) {
            moved = moveOneAttendant(attendant) || moved;
        }

        if (gameFinished) {
            return "";
        }
    }

    return moved
        ? "Something changes rooms while Mara is walking."
        : "";
}

function moveOneAttendant(attendant) {
    const target = getAttendantTarget(attendant);
    const nextStep = findAttendantStep(attendant.position, target);

    if (!nextStep) {
        return false;
    }

    attendant.position = nextStep;
    flashBoard("attendant-warning");
    playSound(attendant.sound);

    if (samePosition(attendant.position, player)) {
        loseGame(`${attendant.name} reaches Mara before she can escape.`);
    }

    return true;
}

function getAttendantTarget(attendant) {
    if (attendant.id === "echo" && movementHistory.length >= 5) {
        return movementHistory[0];
    }

    if (attendant.id === "matron" && lastDirection) {
        let target = { ...player };

        for (let step = 0; step < 3; step += 1) {
            const next = {
                x: target.x + lastDirection.x,
                y: target.y + lastDirection.y
            };

            if (!isWalkable(next.x, next.y)) {
                break;
            }

            target = next;
        }

        return target;
    }

    return player;
}

function findAttendantStep(from, target) {
    const queue = [{ x: from.x, y: from.y, firstStep: null }];
    const visited = new Set([positionKey(from)]);

    for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];

        for (const step of attendantSteps) {
            const next = {
                x: current.x + step.x,
                y: current.y + step.y
            };

            const key = positionKey(next);

            if (!isWalkable(next.x, next.y) || visited.has(key)) {
                continue;
            }

            const firstStep = current.firstStep ?? next;

            if (samePosition(next, target)) {
                return firstStep;
            }

            visited.add(key);
            queue.push({ ...next, firstStep });
        }
    }

    return null;
}

function flashBoard(className) {
    gameBoard.classList.remove(className);
    void gameBoard.offsetWidth;
    gameBoard.classList.add(className);

    window.setTimeout(() => {
        gameBoard.classList.remove(className);
    }, 280);
}

function getAudioContext() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        return null;
    }

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => { });
    }

    return audioContext;
}

function playTone(
    frequency,
    duration,
    volume,
    type = "sine",
    endingFrequency = frequency
) {
    if (!soundEnabled) {
        return;
    }

    const context = getAudioContext();

    if (!context) {
        return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endingFrequency),
        now + duration
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
}

function playSound(name) {
    if (!soundEnabled) {
        return;
    }

    if (name === "step") {
        playTone(105, 0.04, 0.012, "triangle", 92);
    }

    if (name === "echo") {
        playTone(210, 0.12, 0.025, "sine", 150);
    }

    if (name === "echo-burst") {
        playTone(175, 0.24, 0.05, "sawtooth", 62);
    }

    if (name === "attendant-a") {
        playTone(72, 0.14, 0.035, "sawtooth", 48);
    }

    if (name === "attendant-b") {
        playTone(145, 0.12, 0.025, "triangle", 92);
    }

    if (name === "attendant-c") {
        playTone(92, 0.16, 0.03, "square", 58);
    }

    if (name === "ward-light") {
        playTone(392, 0.16, 0.04, "sine", 523);

        window.setTimeout(() => {
            playTone(659, 0.24, 0.035, "sine", 784);
        }, 110);
    }

    if (name === "anchor") {
        playTone(523, 0.16, 0.04, "sine", 660);

        window.setTimeout(() => {
            playTone(784, 0.22, 0.03, "sine", 523);
        }, 120);
    }

    if (name === "win") {
        playTone(392, 0.16, 0.04, "sine", 523);

        window.setTimeout(() => {
            playTone(659, 0.28, 0.035, "sine", 784);
        }, 130);
    }

    if (name === "loss") {
        playTone(130, 0.45, 0.06, "sawtooth", 30);
    }

    if (name === "toggle") {
        playTone(440, 0.08, 0.025, "sine", 550);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    statusText.textContent = soundEnabled ? "Sound on." : "Sound off.";

    if (soundEnabled) {
        playSound("toggle");
    }
}

function finishGame() {
    gameFinished = true;
    messageLabel.textContent = "OUTSIDE BRIAR HOUSE";
    messageText.textContent =
        "Cold air reaches Mara's face. Theo's old phone lights up once: \"I remember the way home.\"";
    statusText.textContent = "Mara makes it outside.";

    playSound("win");
    renderMap();
    updateInterface();

    showStory(
        "OUTSIDE BRIAR HOUSE",
        "Theo is waiting",
        "For the first time in years, the building is quiet. Mara takes Theo's phone into the morning light.",
        "Play again",
        "restart"
    );
}

function loseGame(reason) {
    gameFinished = true;
    messageLabel.textContent = "THE ATTENDANTS";
    messageText.textContent = reason;
    statusText.textContent = "The dream closes around Mara.";

    playSound("loss");
    renderMap();
    updateInterface();

    showStory(
        "THE ATTENDANTS",
        "You were not alone",
        `${reason}\n\nTry another route. The ward lights are limited, and the clinic remembers repeated footsteps.`,
        "Try again",
        "restart"
    );
}

function resetGame() {
    player = findTile("S");
    attendants = createAttendants();
    foundAnchors = new Set();
    foundWardLights = new Set();
    visitedTiles = new Set([positionKey(player)]);
    movementHistory = [{ ...player }];
    lastDirection = null;
    moveCount = 0;
    echoCount = 0;
    wardLightTurns = 0;
    gameFinished = false;
    storyOpen = false;
    storyAction = "close";
    storyPopup.hidden = true;

    messageLabel.textContent = "2:17 AM - NEW MESSAGE";
    messageText.textContent =
        "\"When you close your eyes, I can still move.\"";
    statusText.textContent = "Mara waits at the entrance.";

    renderMap();
    updateInterface();
}

continueButton.addEventListener("click", handleContinue);

window.addEventListener("keydown", (event) => {
    if (event.repeat) {
        return;
    }

    if (event.key === "r" || event.key === "R") {
        resetGame();
        return;
    }

    if (event.key === "m" || event.key === "M") {
        toggleSound();
        return;
    }

    if (storyOpen && event.key === "Enter") {
        event.preventDefault();
        handleContinue();
        return;
    }

    const direction = directions[event.key];

    if (direction) {
        event.preventDefault();
        movePlayer(direction);
    }
});

resetGame();