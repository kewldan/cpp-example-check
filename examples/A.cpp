#include <algorithm>
#include <cstdint>
#include <iostream>
#include <vector>

/*
input:
5
1 -2 3 4 -1
output:
7
*/

/*
input:
3
-7 -2 -10
output:
-2
*/

int main() {
  int n;
  std::cin >> n;
  std::vector<int64_t> a(n);
  for (auto& x : a) {
    std::cin >> x;
  }

  int64_t best = 0;
  int64_t current = 0;
  for (int64_t x : a) {
    current = std::max(x, current + x);
    best = std::max(best, current);
  }
  std::cout << best << '\n';
}
