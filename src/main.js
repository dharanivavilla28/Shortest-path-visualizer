import './style.css';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { buildAdjacencyList, dijkstra } from './algorithm.js';

// ─── Initial Graph Data ───────────────────────────────────────────────────────
const INITIAL_NODES = [
  { id: 1, label: 'A' }, { id: 2, label: 'B' }, { id: 3, label: 'C' },
  { id: 4, label: 'D' }, { id: 5, label: 'E' }, { id: 6, label: 'F' },
  { id: 7, label: 'G' }
];
const INITIAL_EDGES = [
  { id: 'e1',  from: 1, to: 2, label: '4' },
  { id: 'e2',  from: 1, to: 5, label: '2' },
  { id: 'e3',  from: 1, to: 4, label: '5' },
  { id: 'e4',  from: 2, to: 3, label: '3' },
  { id: 'e5',  from: 2, to: 5, label: '1' },
  { id: 'e6',  from: 3, to: 5, label: '4' },
  { id: 'e7',  from: 3, to: 6, label: '2' },
  { id: 'e8',  from: 4, to: 5, label: '3' },
  { id: 'e9',  from: 4, to: 7, label: '1' },
  { id: 'e10', from: 5, to: 6, label: '5' },
  { id: 'e11', from: 5, to: 7, label: '2' },
  { id: 'e12', from: 6, to: 7, label: '3' }
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const NODE_DEFAULT = {
  color: { background: '#3b82f6', border: '#2563eb', highlight: { background: '#60a5fa', border: '#1d4ed8' }, hover: { background: '#60a5fa', border: '#2563eb' } },
  font: { color: '#ffffff', size: 15, face: 'Inter', bold: true },
  borderWidth: 2, borderWidthSelected: 3, size: 22,
  shadow: { enabled: true, color: 'rgba(59,130,246,0.3)', size: 8 }
};
const EDGE_DEFAULT = {
  color: { color: '#94a3b8', highlight: '#64748b', hover: '#3b82f6' },
  width: 2, selectionWidth: 5, hoverWidth: 3,
  font: { color: '#475569', size: 13, face: 'Inter', strokeWidth: 3, strokeColor: '#ffffff', align: 'middle' },
  smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
  shadow: false,
  title: 'Click to edit weight'
};

// ─── State ─────────────────────────────────────────────────────────────────────
let nodes = new DataSet(INITIAL_NODES.map(n => ({ ...n })));
let edges = new DataSet(INITIAL_EDGES.map(e => ({ ...e })));
let network = null;
let startNode = null;
let endNode   = null;
let timers    = [];
let nodeIdCounter = 8;
let edgeIdCounter = 13;
let currentMode = null; // 'addNode' | 'addEdge' | null

// ─── Network Init ─────────────────────────────────────────────────────────────
function initNetwork() {
  const container = document.getElementById('graph-canvas');

  const options = {
    nodes: NODE_DEFAULT,
    edges: EDGE_DEFAULT,
    physics: {
      enabled: true,
      solver: 'barnesHut',
      barnesHut: { gravitationalConstant: -3000, centralGravity: 0.4, springLength: 160, springConstant: 0.04, damping: 0.1 },
      stabilization: { iterations: 150, updateInterval: 25 }
    },
    interaction: { hover: true, selectConnectedEdges: false, dragView: true, tooltipDelay: 200 },
    manipulation: { enabled: false }
  };

  network = new Network(container, { nodes, edges }, options);

  network.on('click', onCanvasClick);
  // After stabilization, PERMANENTLY freeze physics so node updates never trigger re-layout
  network.on('stabilizationIterationsDone', () => {
    network.setOptions({ physics: { enabled: false } });
    // Store current positions as fixed so vis-network never moves them again
    nodes.forEach(n => {
      const pos = network.getPosition(n.id);
      nodes.update({ id: n.id, x: pos.x, y: pos.y, physics: false });
    });
  });
}

// ─── Click handler ────────────────────────────────────────────────────────────
function onCanvasClick(params) {
  const clickedNode = params.nodes[0];

  if (currentMode === 'addNode') {
    const pos = network.DOMtoCanvas({ x: params.pointer.DOM.x, y: params.pointer.DOM.y });
    addNodeAt(pos.x, pos.y);
    return;
  }

  if (currentMode === 'addEdge') {
    // vis-network will handle addEdge via manipulation — not used here
    // We use manual edge connecting below
    return;
  }

  if (clickedNode !== undefined) {
    handleNodeSelect(clickedNode);
  } else if (params.edges.length > 0 && currentMode === null) {
    // Edge clicked — open weight edit modal
    showEdgeEditModal(params.edges[0]);
  } else {
    // Clicked on empty canvas — deselect
    network.unselectAll();
  }
}

function handleNodeSelect(id) {
  if (id === startNode) { setStart(null); syncPath(false); return; }
  if (id === endNode)   { setEnd(null);   syncPath(false); return; }
  if (!startNode)       { setStart(id); }
  else if (!endNode)    { setEnd(id); }
  else                  { setStart(id); setEnd(null); }
  syncPath(false);
}

// ─── Node / Edge Creation ─────────────────────────────────────────────────────
function addNodeAt(x, y) {
  const label = String.fromCharCode(64 + nodeIdCounter) || `N${nodeIdCounter}`;
  const id = nodeIdCounter++;
  nodes.add({ id, label, x, y });
  syncRightPanel();
  syncPath(false);
}

function addEdgeBetween(fromId, toId, weight) {
  if (fromId === toId) return;
  const exists = edges.get().some(e => (e.from == fromId && e.to == toId) || (e.from == toId && e.to == fromId));
  if (exists) return;
  const id = 'e' + edgeIdCounter++;
  edges.add({ id, from: fromId, to: toId, label: String(weight) });
  syncPath(false);
}

// ─── Selection Setters ────────────────────────────────────────────────────────
function setStart(id) {
  startNode = id;
  document.getElementById('startDisplay').textContent = id ? nodes.get(id)?.label || id : 'None';
  document.getElementById('startSelect').value = id || '';
  updateNodeColors();
  updateLocCards();
}

function setEnd(id) {
  endNode = id;
  document.getElementById('endDisplay').textContent = id ? nodes.get(id)?.label || id : 'None';
  document.getElementById('endSelect').value = id || '';
  updateNodeColors();
  updateLocCards();
}

function updateNodeColors() {
  const updates = [];
  nodes.forEach(n => {
    const pos = network ? safeGetPos(n.id) : {};
    if (n.id == startNode) {
      updates.push({ id: n.id, ...pos, physics: false, color: { background: '#1d4ed8', border: '#1e3a8a' }, size: 26, font: { ...NODE_DEFAULT.font, size: 17 } });
    } else if (n.id == endNode) {
      updates.push({ id: n.id, ...pos, physics: false, color: { background: '#ef4444', border: '#b91c1c' }, size: 26, font: { ...NODE_DEFAULT.font, size: 17 } });
    } else {
      updates.push({ id: n.id, ...pos, physics: false, color: NODE_DEFAULT.color, size: NODE_DEFAULT.size, font: NODE_DEFAULT.font });
    }
  });
  nodes.update(updates);
}

// Helper: safely get position without error if network not ready
function safeGetPos(id) {
  try {
    const p = network.getPosition(id);
    return { x: p.x, y: p.y };
  } catch { return {}; }
}

// ─── Status Banner ────────────────────────────────────────────────────────────
function setStatus(state, text, icon) {
  const banner = document.getElementById('statusBanner');
  const textEl = document.getElementById('statusText');
  const iconEl = document.getElementById('statusIcon');
  banner.className = `status-banner status-${state}`;
  textEl.textContent = text;
  iconEl.textContent = icon;
}

// ─── Algorithm + Animation ────────────────────────────────────────────────────
function syncPath(animate) {
  clearVisualization();

  if (!startNode || !endNode) {
    document.getElementById('timeTaken').textContent = '—';
    document.getElementById('pathCost').textContent = '—';
    document.getElementById('pathPreview').textContent = '';
    document.getElementById('pathInfo').classList.add('hidden');
    setStatus('idle', 'Select a Start and End node to find the shortest path', '⬡');
    return;
  }

  setStatus('computing', 'Computing shortest path…', '⏳');

  const graph = buildAdjacencyList(nodes, edges);
  const result = dijkstra(graph, startNode, endNode);

  document.getElementById('timeTaken').textContent = result.timeTaken.toFixed(3) + 'ms';

  if (result.paths.length === 0) {
    const fromLabel = nodes.get(startNode)?.label || startNode;
    const toLabel   = nodes.get(endNode)?.label   || endNode;
    document.getElementById('pathCost').textContent = '∞ (No path)';
    document.getElementById('pathCost').style.color = '#ef4444';
    document.getElementById('pathPreview').textContent = '';
    document.getElementById('pathInfo').classList.add('hidden');
    setStatus('no-path', `No path exists from ${fromLabel} to ${toLabel}`, '⚠');
    return;
  }

  const fromLabel = nodes.get(startNode)?.label || startNode;
  const toLabel   = nodes.get(endNode)?.label   || endNode;
  document.getElementById('pathCost').textContent = result.distance;
  document.getElementById('pathCost').style.color = '#22c55e';
  
  // Update path preview info in UI using the first path found
  renderPathSteps(result.paths[0].pathNodes);
  
  const pathCount = result.paths.length;
  const pathText = pathCount > 1 ? `Found ${pathCount} equal paths` : 'Path found';
  setStatus('found', `${pathText}: ${fromLabel} → ${toLabel}  ·  Cost: ${result.distance}  ·  ${result.timeTaken.toFixed(2)}ms`, '✅');

  if (!animate) {
    // Static highlights
    result.exploredNodes.forEach(id => {
      if (id != startNode && id != endNode) highlightNode(id, 'explored');
    });
    result.paths.forEach(p => {
      p.pathEdges.forEach(id => highlightEdge(id));
      p.pathNodes.forEach(id => {
        if (id != startNode && id != endNode) highlightNode(id, 'path');
      });
    });
  } else {
    animateResult(result);
  }
}

function animateResult(result) {
  const speed = parseInt(document.getElementById('speedSlider').value);
  let delay = 0;

  // 1. Animate explored edges/nodes (Search phase)
  result.exploredNodes.forEach(id => {
    if (id == startNode || id == endNode) return;
    const t = setTimeout(() => highlightNode(id, 'explored'), delay);
    timers.push(t);
    delay += (speed * 0.5); // Fast search animation
  });

  // 2. Animate shortest paths with "snake" fill
  const pathDelay = delay + 200;
  timers.push(setTimeout(() => {
    result.paths.forEach((p, idx) => {
      drawFluidPath(p.pathNodes, speed * 2, idx * 50);
    });
    
    // Also highlight the underlying edges/nodes in vis-network slightly after
    result.paths.forEach(p => {
      p.pathEdges.forEach((id, i) => {
        timers.push(setTimeout(() => highlightEdge(id), i * 100));
      });
      p.pathNodes.forEach((id, i) => {
        if (id != startNode && id != endNode) {
          timers.push(setTimeout(() => highlightNode(id, 'path'), i * 100));
        }
      });
    });
  }, pathDelay));
}

function highlightNode(id, type) {
  if (id == startNode || id == endNode) return;
  const pos = safeGetPos(id);
  if (type === 'explored') nodes.update({ id, ...pos, physics: false, color: { background: '#f59e0b', border: '#d97706' } });
  if (type === 'path')     nodes.update({ id, ...pos, physics: false, color: { background: '#22c55e', border: '#16a34a' } });
}

function highlightEdge(id) {
  edges.update({ id, color: { color: '#22c55e' }, width: 4,
    shadow: { enabled: true, color: 'rgba(34,197,94,0.4)', size: 6 } });
}

// ─── SVG Overlay Helpers ───────────────────────────────────────────────────────
function drawFluidPath(pathNodes, duration, startDelay) {
  const svg = document.getElementById('path-overlay');
  if (!svg) return;

  const points = pathNodes.map(id => network.canvasToDOM(network.getPosition(id)));
  
  if (points.length < 2) return;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }

  path.setAttribute('d', d);
  path.setAttribute('class', 'fluid-path');
  svg.appendChild(path);

  const length = path.getTotalLength();
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
  path.style.animationDuration = `${duration}ms`;
  path.style.animationDelay = `${startDelay}ms`;
  
  path.classList.add('animate-draw');
}

function clearSVG() {
  const svg = document.getElementById('path-overlay');
  if (svg) svg.innerHTML = '';
}

function clearVisualization() {
  timers.forEach(clearTimeout); timers = [];
  clearSVG();

  const eUp = [];
  edges.forEach(e => eUp.push({ id: e.id, color: EDGE_DEFAULT.color, width: EDGE_DEFAULT.width, shadow: false }));
  edges.update(eUp);

  const nUp = [];
  nodes.forEach(n => {
    if (n.id != startNode && n.id != endNode) {
      const pos = safeGetPos(n.id);
      nUp.push({ id: n.id, ...pos, physics: false, color: NODE_DEFAULT.color });
    }
  });
  nodes.update(nUp);
}

// ─── Right Panel ──────────────────────────────────────────────────────────────
function syncRightPanel() {
  const startSel = document.getElementById('startSelect');
  const endSel   = document.getElementById('endSelect');
  const grid     = document.getElementById('locationGrid');
  const badge    = document.getElementById('nodeCount');

  const prevStart = startSel.value;
  const prevEnd   = endSel.value;
  startSel.innerHTML = '<option value="">Select location...</option>';
  endSel.innerHTML   = '<option value="">Select location...</option>';
  grid.innerHTML = '';

  let count = 0;
  nodes.forEach(n => {
    count++;
    const name = `Location ${n.label}`;
    const s = new Option(name, n.id); startSel.add(s);
    const e = new Option(name, n.id); endSel.add(e);

    const card = document.createElement('div');
    card.className = 'loc-card';
    card.dataset.nodeId = n.id;
    card.innerHTML = `<span class="loc-pin">📍</span><span class="loc-name">${name}</span>`;
    card.addEventListener('click', () => handleNodeSelect(n.id));
    grid.appendChild(card);
  });

  badge.textContent = count;
  if (nodes.get(prevStart)) startSel.value = prevStart;
  if (nodes.get(prevEnd))   endSel.value   = prevEnd;
  updateLocCards();
}

function updateLocCards() {
  document.querySelectorAll('.loc-card').forEach(card => {
    const id = card.dataset.nodeId;
    card.classList.remove('is-start', 'is-end');
    card.querySelectorAll('.loc-role').forEach(r => r.remove());

    if (id == startNode) {
      card.classList.add('is-start');
      card.insertAdjacentHTML('beforeend', '<span class="loc-role start-role">START</span>');
    } else if (id == endNode) {
      card.classList.add('is-end');
      card.insertAdjacentHTML('beforeend', '<span class="loc-role end-role">END</span>');
    }
  });
}

function renderPathSteps(pathNodes) {
  const container = document.getElementById('pathSteps');
  const pathInfo  = document.getElementById('pathInfo');
  container.innerHTML = '';

  if (!pathNodes.length) { pathInfo.classList.add('hidden'); return; }
  pathInfo.classList.remove('hidden');

  pathNodes.forEach((id, i) => {
    const n = nodes.get(parseInt(id)) || nodes.get(id);
    const label = n ? n.label : id;
    const cls = i === 0 ? 'start-n' : i === pathNodes.length - 1 ? 'end-n' : '';
    const span = document.createElement('span');
    span.className = `step-node ${cls}`;
    span.textContent = label;
    container.appendChild(span);

    if (i < pathNodes.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'step-arrow';
      arrow.textContent = '→';
      container.appendChild(arrow);
    }
  });

  // Also update path preview text in left panel
  const labels = pathNodes.map(id => {
    const n = nodes.get(parseInt(id)) || nodes.get(id);
    return n ? n.label : id;
  });
  document.getElementById('pathPreview').textContent = labels.join(' → ');
}

// ─── Mode Management ──────────────────────────────────────────────────────────
let edgePending = null;

function setMode(mode) {
  currentMode = mode;
  edgePending = null;
  const label   = document.getElementById('modeLabel');
  const modeName = document.getElementById('modeName');
  const allBtns = document.querySelectorAll('.ctrl-btn');

  allBtns.forEach(b => b.classList.remove('active-mode'));

  if (mode === 'addNode') {
    label.classList.remove('hidden');
    modeName.textContent = 'Add Node — click canvas';
    document.getElementById('btnAddNode').classList.add('active-mode');
  } else if (mode === 'addEdge') {
    label.classList.remove('hidden');
    modeName.textContent = 'Add Edge — click first node';
    document.getElementById('btnAddEdge').classList.add('active-mode');
  } else {
    label.classList.add('hidden');
  }
}

// ─── Edge Weight Modal ────────────────────────────────────────────────────────
let pendingEdgeFrom = null;
let pendingEdgeTo   = null;
let pendingEdgeId   = null;  // set when editing existing edge
let autoWeightValue = 1;
let modalMode = 'add'; // 'add' | 'edit'

function showEdgeModal(fromId, toId) {
  modalMode = 'add';
  pendingEdgeFrom = fromId;
  pendingEdgeTo   = toId;
  pendingEdgeId   = null;
  autoWeightValue = Math.floor(Math.random() * 9) + 1;

  const fromNode = nodes.get(fromId);
  const toNode   = nodes.get(toId);
  document.getElementById('edge-modal-title-text').textContent = '⟷ Set Edge Weight';
  document.getElementById('edgeFromLabel').textContent = fromNode?.label || fromId;
  document.getElementById('edgeToLabel').textContent   = toNode?.label   || toId;
  document.getElementById('autoWeightPreview').textContent = autoWeightValue;
  document.getElementById('edgeWeightInput').value = '';
  document.getElementById('edgeWeightInput').placeholder = 'Enter weight';
  document.getElementById('edgeWeightInput').style.borderColor = '';
  document.getElementById('edgeOptAuto').classList.remove('selected');
  document.getElementById('edgeConfirmBtn').textContent = 'Add Edge';
  document.getElementById('edgeWeightModal').classList.remove('hidden');
  document.getElementById('edgeWeightInput').focus();
}

function showEdgeEditModal(edgeId) {
  const edge = edges.get(edgeId);
  if (!edge) return;

  modalMode = 'edit';
  pendingEdgeFrom = null;
  pendingEdgeTo   = null;
  pendingEdgeId   = edgeId;
  autoWeightValue = Math.floor(Math.random() * 9) + 1;

  const fromNode = nodes.get(edge.from);
  const toNode   = nodes.get(edge.to);
  const currentWeight = edge.label || '?';

  document.getElementById('edge-modal-title-text').textContent = '✏ Edit Edge Weight';
  document.getElementById('edgeFromLabel').textContent = fromNode?.label || edge.from;
  document.getElementById('edgeToLabel').textContent   = toNode?.label   || edge.to;
  document.getElementById('autoWeightPreview').textContent = autoWeightValue;
  document.getElementById('edgeWeightInput').value = currentWeight;
  document.getElementById('edgeWeightInput').placeholder = 'New weight';
  document.getElementById('edgeWeightInput').style.borderColor = '';
  document.getElementById('edgeOptAuto').classList.remove('selected');
  document.getElementById('edgeConfirmBtn').textContent = 'Update Weight';
  document.getElementById('edgeWeightModal').classList.remove('hidden');
  document.getElementById('edgeWeightInput').select();
}

function closeEdgeModal() {
  document.getElementById('edgeWeightModal').classList.add('hidden');
  pendingEdgeFrom = null;
  pendingEdgeTo   = null;
  pendingEdgeId   = null;
}

function handleEdgeMode(params) {
  if (currentMode !== 'addEdge') return;
  const clickedNode = params.nodes[0];
  if (clickedNode === undefined) return;

  if (!edgePending) {
    edgePending = clickedNode;
    document.getElementById('modeName').textContent = `Add Edge — now click second node (from: ${nodes.get(clickedNode)?.label})`;
    nodes.update({ id: clickedNode, ...safeGetPos(clickedNode), physics: false, color: { background: '#8b5cf6', border: '#6d28d9' } });
  } else {
    const fromId = edgePending;
    const toId   = clickedNode;
    // Restore pending node colour before modal
    nodes.update({ id: fromId, ...safeGetPos(fromId), physics: false,
      color: startNode == fromId ? { background: '#1d4ed8', border: '#1e3a8a' } : NODE_DEFAULT.color });
    edgePending = null;
    setMode('addEdge');
    showEdgeModal(fromId, toId);
  }
}

// ─── Random Graph ─────────────────────────────────────────────────────────────
function generateRandomGraph() {
  nodes.clear(); edges.clear();
  startNode = null; endNode = null;
  setStart(null); setEnd(null);
  nodeIdCounter = 1; edgeIdCounter = 1;

  const count = 7 + Math.floor(Math.random() * 4); // 7–10 nodes
  const newNodes = [];
  for (let i = 1; i <= count; i++) {
    newNodes.push({ id: i, label: String.fromCharCode(64 + i) });
  }
  nodes.add(newNodes);

  const newEdges = [];
  // Spanning tree first (connected)
  for (let i = 2; i <= count; i++) {
    const from = Math.floor(Math.random() * (i - 1)) + 1;
    const w = Math.floor(Math.random() * 9) + 1;
    newEdges.push({ id: 'e' + edgeIdCounter++, from, to: i, label: String(w) });
  }
  // Extra edges
  const extras = Math.floor(count * 0.7);
  for (let i = 0; i < extras; i++) {
    const from = Math.floor(Math.random() * count) + 1;
    let to = Math.floor(Math.random() * count) + 1;
    if (from !== to) {
      const exists = newEdges.some(e => (e.from == from && e.to == to) || (e.from == to && e.to == from));
      if (!exists) {
        const w = Math.floor(Math.random() * 9) + 1;
        newEdges.push({ id: 'e' + edgeIdCounter++, from, to, label: String(w) });
      }
    }
  }
  edges.add(newEdges);
  nodeIdCounter = count + 1;
  network.setOptions({ physics: { enabled: true } });
  setTimeout(() => network.setOptions({ physics: { enabled: false } }), 2000);
  syncRightPanel();
}

// ─── Wiring ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNetwork();

  // Re-wire click with edge mode support
  network.off('click', onCanvasClick);
  network.on('click', params => {
    if (currentMode === 'addEdge') { handleEdgeMode(params); return; }
    if (currentMode === 'addNode') {
      const pos = network.DOMtoCanvas({ x: params.pointer.DOM.x, y: params.pointer.DOM.y });
      addNodeAt(pos.x, pos.y);
      return;
    }
    const clickedNode = params.nodes[0];
    if (clickedNode !== undefined) handleNodeSelect(clickedNode);
  });

  document.getElementById('btnAddNode').addEventListener('click', () => {
    setMode(currentMode === 'addNode' ? null : 'addNode');
  });
  document.getElementById('btnAddEdge').addEventListener('click', () => {
    setMode(currentMode === 'addEdge' ? null : 'addEdge');
  });
  document.getElementById('btnDelete').addEventListener('click', () => {
    const sel = network.getSelectedNodes();
    const selE = network.getSelectedEdges();
    sel.forEach(id => {
      if (id == startNode) setStart(null);
      if (id == endNode)   setEnd(null);
    });
    nodes.remove(sel);
    edges.remove(selE);
    syncRightPanel();
    syncPath(false);
  });
  document.getElementById('btnShowPath').addEventListener('click', () => {
    if (!startNode || !endNode) {
      alert('Please select a Start and End node first!');
      return;
    }
    syncPath(true); // Animated
  });
  document.getElementById('btnClearPath').addEventListener('click', () => {
    clearVisualization();
    document.getElementById('pathInfo').classList.add('hidden');
    document.getElementById('timeTaken').textContent = '—';
    document.getElementById('pathCost').textContent  = '—';
    document.getElementById('pathPreview').textContent = '';
    updateNodeColors();
  });
  document.getElementById('btnReset').addEventListener('click', () => {
    nodes.clear(); edges.clear();
    nodes.add(INITIAL_NODES.map(n => ({ ...n })));
    edges.add(INITIAL_EDGES.map(e => ({ ...e })));
    nodeIdCounter = 8; edgeIdCounter = 13;
    setStart(null); setEnd(null);
    clearVisualization();
    setMode(null);
    network.setOptions({ physics: { enabled: true } });
    setTimeout(() => network.setOptions({ physics: { enabled: false } }), 1500);
    syncRightPanel();
    document.getElementById('pathInfo').classList.add('hidden');
    document.getElementById('timeTaken').textContent = '—';
    document.getElementById('pathCost').textContent  = '—';
  });
  document.getElementById('btnRandom').addEventListener('click', generateRandomGraph);
  document.getElementById('cancelMode').addEventListener('click', () => setMode(null));

  document.getElementById('startSelect').addEventListener('change', e => {
    setStart(e.target.value || null);
    syncPath(false);
  });
  document.getElementById('endSelect').addEventListener('change', e => {
    setEnd(e.target.value || null);
    syncPath(false);
  });

  // ── Edge Weight Modal wiring ──────────────────────────────────────────────

  // Click "Auto" pill → select it, clear manual input
  document.getElementById('edgeOptAuto').addEventListener('click', () => {
    document.getElementById('edgeOptAuto').classList.add('selected');
    document.getElementById('edgeWeightInput').value = '';
    // Re-roll to give a fresh random on each click
    autoWeightValue = Math.floor(Math.random() * 9) + 1;
    document.getElementById('autoWeightPreview').textContent = autoWeightValue;
  });

  // Typing in manual input → deselect auto pill
  document.getElementById('edgeWeightInput').addEventListener('input', () => {
    document.getElementById('edgeOptAuto').classList.remove('selected');
  });

  // Cancel
  document.getElementById('edgeCancelBtn').addEventListener('click', () => {
    closeEdgeModal();
    setMode('addEdge'); // Stay in add-edge mode so user can try again
  });

  // Confirm: figure out which weight to use
  document.getElementById('edgeConfirmBtn').addEventListener('click', () => {
    commitEdge();
  });

  // Also confirm on Enter key inside the input
  document.getElementById('edgeWeightInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') commitEdge();
    if (e.key === 'Escape') {
      closeEdgeModal();
      setMode('addEdge');
    }
  });

  syncRightPanel();

  // ── Sync SVG on View Changes ──────────────────────────────────────────────
  network.on('zoom', clearSVG);
  network.on('dragging', clearSVG);
  window.addEventListener('resize', () => {
    clearSVG();
    if (network) network.redraw();
  });
});

// Commit edge from modal — handles both 'add' and 'edit' modes
function commitEdge() {
  const autoSelected = document.getElementById('edgeOptAuto').classList.contains('selected');
  const manualVal    = parseInt(document.getElementById('edgeWeightInput').value, 10);
  const inputEl      = document.getElementById('edgeWeightInput');

  let weight;
  if (autoSelected) {
    weight = autoWeightValue;
  } else if (!isNaN(manualVal) && manualVal >= 1) {
    weight = manualVal;
  } else if (!isNaN(manualVal) && manualVal < 1) {
    inputEl.style.borderColor = '#ef4444';
    inputEl.placeholder = 'Must be ≥ 1';
    return;
  } else {
    // Nothing entered — use auto silently
    weight = autoWeightValue;
  }

  inputEl.style.borderColor = '';

  if (modalMode === 'edit') {
    // Update existing edge weight
    if (!pendingEdgeId) { closeEdgeModal(); return; }
    edges.update({ id: pendingEdgeId, label: String(weight) });
    closeEdgeModal();
    syncPath(false); // Recompute path immediately with new weight
  } else {
    // Add new edge
    if (!pendingEdgeFrom || !pendingEdgeTo) { closeEdgeModal(); return; }
    addEdgeBetween(pendingEdgeFrom, pendingEdgeTo, weight);
    closeEdgeModal();
    syncRightPanel();
  }
}

