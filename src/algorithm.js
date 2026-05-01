/**
 * MinPriorityQueue using a Min-Heap
 * Stores elements as objects: { id (node id), priority (distance) }
 */
export class MinPriorityQueue {
  constructor() {
    this.heap = [];
    this.positions = new Map(); // Keep track of positions for O(log V) updates
  }

  enqueue(id, priority) {
    if (this.positions.has(id)) {
      // If node is already in queue, update its priority (decrease-key)
      this.updatePriority(id, priority);
      return;
    }

    const node = { id, priority };
    this.heap.push(node);
    const index = this.heap.length - 1;
    this.positions.set(id, index);
    this._bubbleUp(index);
  }

  dequeue() {
    if (this.isEmpty()) return null;

    const min = this.heap[0];
    const end = this.heap.pop();
    this.positions.delete(min.id);

    if (this.heap.length > 0) {
      this.heap[0] = end;
      this.positions.set(end.id, 0);
      this._sinkDown(0);
    }
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  updatePriority(id, priority) {
    const minQIdx = this.positions.get(id);
    if (minQIdx === undefined) return;
    
    if (priority < this.heap[minQIdx].priority) {
      this.heap[minQIdx].priority = priority;
      this._bubbleUp(minQIdx);
    }
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];

      if (element.priority >= parent.priority) break;

      this.heap[parentIndex] = element;
      this.heap[index] = parent;
      this.positions.set(element.id, parentIndex);
      this.positions.set(parent.id, index);
      index = parentIndex;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      let leftChildIndex = 2 * index + 1;
      let rightChildIndex = 2 * index + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (leftChild.priority < element.priority) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;

      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      this.positions.set(this.heap[index].id, index);
      this.positions.set(this.heap[swap].id, swap);
      index = swap;
    }
  }
}

/**
 * Transforms vis.js nodes and edges into an adjacency list
 * Returns an object { [nodeId]: { [neighborId]: { weight, edgeId } } }
 */
export function buildAdjacencyList(nodes, edges) {
  const adjList = {};
  
  nodes.get().forEach(node => {
    adjList[node.id] = {};
  });

  edges.get().forEach(edge => {
    const { from, to, id } = edge;
    // Edge weight: custom weight property or default to 1 (or compute distance)
    // To make it visually correct based on position, we could use geometric distance, but let's just use 1 or specifically set weights.
    // If we map weights on edges, we read them. Assuming default `weight` property.
    let weight = parseFloat(edge.label) || 1;
    if (isNaN(weight) || weight <= 0) weight = 1;

    if (adjList[from] && adjList[to]) {
      adjList[from][to] = { weight, edgeId: id };
      // Standard vis.js edges are directed if arrows are configured, but typically it is an undirected graph for shortest path problems unless specified.
      // Let's assume undirected for wider capabilities.
      // Wait, vis-network edges can be directed. Let's assume undirected by default.
      adjList[to][from] = { weight, edgeId: id };
    }
  });

  return adjList;
}

/**
 * Dijkstra's Shortest Path Algorithm (FIND ALL EQUAL SHORTEST PATHS)
 * @param {Object} graph Adjacency list from `buildAdjacencyList`
 * @param {string|number} startId 
 * @param {string|number} endId 
 * @returns {Object} { paths[], exploredNodes[], distance, timeTaken }
 *  - paths: Array of { pathNodes[], pathEdges[] }
 */
export function dijkstra(graph, startId, endId) {
  const t0 = performance.now();
  
  const distances = {};
  const parents = {}; // Stores arrays of {node, edgeId} to track multiple shortest paths
  const pq = new MinPriorityQueue();
  const exploredNodes = [];

  // Initialization
  Object.keys(graph).forEach(nodeId => {
    const id = String(nodeId);
    distances[id] = Infinity;
    parents[id] = [];
  });

  const startStr = String(startId);
  const endStr = String(endId);

  distances[startStr] = 0;
  pq.enqueue(startStr, 0);

  while (!pq.isEmpty()) {
    const { id: currentId, priority: currentDist } = pq.dequeue();

    if (!exploredNodes.includes(currentId)) {
      exploredNodes.push(currentId);
    }

    if (currentDist > distances[currentId]) continue;
    if (currentId === endStr) break;

    if (!graph[currentId]) continue;

    for (let neighbor in graph[currentId]) {
      const neighborInfo = graph[currentId][neighbor];
      const weight = neighborInfo.weight;
      const candidateDist = currentDist + weight;

      if (candidateDist < distances[neighbor]) {
        // Found a shorter path: reset parents and update distance
        distances[neighbor] = candidateDist;
        parents[neighbor] = [{ node: currentId, edgeId: neighborInfo.edgeId }];
        pq.enqueue(neighbor, candidateDist);
      } else if (candidateDist === distances[neighbor]) {
        // Found an alternative path of the same cost: add to parents
        parents[neighbor].push({ node: currentId, edgeId: neighborInfo.edgeId });
      }
    }
  }

  // If there's no path to end node (distance is Infinity)
  if (distances[endStr] === Infinity) {
    return {
      paths: [],
      exploredNodes,
      distance: Infinity,
      timeTaken: performance.now() - t0
    };
  }

  // Recursive function to backtrack and collect ALL shortest paths
  const allPaths = [];
  function collectPaths(currNode, currentPathNodes, currentPathEdges) {
    if (currNode === startStr) {
      allPaths.push({
        pathNodes: [...currentPathNodes].reverse(),
        pathEdges: [...currentPathEdges].reverse()
      });
      return;
    }

    for (const p of parents[currNode]) {
      currentPathNodes.push(p.node);
      currentPathEdges.push(p.edgeId);
      collectPaths(p.node, currentPathNodes, currentPathEdges);
      currentPathNodes.pop();
      currentPathEdges.pop();
    }
  }

  collectPaths(endStr, [endStr], []);

  return {
    paths: allPaths,
    exploredNodes,
    distance: distances[endStr],
    timeTaken: performance.now() - t0
  };
}
