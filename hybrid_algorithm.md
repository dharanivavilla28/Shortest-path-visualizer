# Hybrid Predictive Shortest Path Algorithm

*The following content is formatted for direct inclusion into your research paper.*

## 1. Mathematical Formulation

The core innovation of the proposed system is the integration of predictive node relevance into the priority queue of Dijkstra's algorithm. We define a modified priority function $P(v)$ for exploring any node $v$:

$$P(v) = d(v) + (1 - \sigma(v)) \times K$$

**Where:**
*   $d(v)$: The current tentative minimum distance from the source node to node $v$.
*   $\sigma(v)$: The predictive relevance score of node $v$, where $\sigma(v) \in [0, 1]$. A score closer to $1.0$ indicates a high probability that the node lies on the optimal path.
*   $K$: A tunable scaling constant (penalty weight) that determines the influence of the predictive ML layer versus the raw distance. 

**Mechanism:** 
In a standard Binary Min-Heap, nodes with the lowest priority value are extracted first. By subtracting the relevance score $\sigma(v)$ from $1$, we convert a *high relevance* into a *low penalty*. Therefore, highly relevant nodes (like major highways) receive almost no penalty and are explored immediately. Irrelevant nodes receive a massive penalty $(K)$ and are pushed to the back of the queue, effectively pruning them from the search space.

## 2. The Algorithm Pseudocode

```text
Algorithm: Hybrid Predictive Shortest Path
Input: Graph G(V, E), Source S, Target T, Scaling Constant K, Confidence Threshold τ
Output: Optimal Path, Total Distance, Visited Nodes Count

1. Initialize dist[v] = ∞ for all v ∈ V
2. Initialize pred[v] = empty list for all v ∈ V
3. dist[S] = 0
4. PriorityQueue Q = empty MinHeap
5. 
6. // Calculate initial priority for source
7. P(S) = dist[S] + (1 - σ(S)) * K
8. Q.insert(S, P(S))
9. 
10. visited_count = 0
11. 
12. WHILE Q is not empty DO
13.     u = Q.extractMin()
14.     visited_count = visited_count + 1
15.     
16.     IF u == T THEN
17.         BREAK // Target reached
18.         
19.     FOR EACH neighbor v of u DO
20.         // Confidence-Aware Pruning
21.         IF σ(v) < τ AND v != T THEN
22.             CONTINUE // Skip irrelevant nodes
23.             
24.         alt_distance = dist[u] + weight(u, v)
25.         
26.         IF alt_distance < dist[v] THEN
27.             dist[v] = alt_distance
28.             pred[v] = [u]
29.             
30.             // Apply Hybrid Priority Formula
31.             P(v) = dist[v] + (1 - σ(v)) * K
32.             Q.insertOrUpdate(v, P(v))
33.             
34.         ELSE IF alt_distance == dist[v] THEN
35.             // Multi-path discovery support
36.             pred[v].append(u)
37.             
38.     END FOR
39. END WHILE
40. 
41. // Fallback Mechanism
42. IF T is not reached AND visited_count > 0 THEN
43.     RETURN RunStandardDijkstra(S, T) // Fallback due to over-pruning
44.     
45. RETURN ReconstructPath(T, pred), dist[T], visited_count
```

## 3. Online Adaptation (Learning Mechanism)

The algorithm operates in a continuous learning loop. After every successful query that yields an optimal path $P_{opt}$, the relevance score of the graph is updated using an exponential moving average. 

For every node $v \in V$:
$$Frequency_{new}(v) = 0.7 \times Frequency_{old}(v) + 0.3 \times I(v \in P_{opt})$$
*(where $I$ is an indicator function returning 1 if true, 0 if false)*

This ensures that the system adapts to changing traffic patterns without requiring a complete offline retraining of the neural network/ML layer.
