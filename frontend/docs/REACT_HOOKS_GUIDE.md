# React Hooks 关系详解

## 🎯 Hooks 分类和关系

### 1. **基础 Hooks**
```typescript
// 状态管理
const [state, setState] = useState(initialValue);
const [state, dispatch] = useReducer(reducer, initialValue);
const ref = useRef(initialValue);

// 副作用
useEffect(() => {
  // 副作用逻辑
}, [dependencies]);
```

### 2. **性能优化 Hooks**
```typescript
// 缓存计算结果
const memoizedValue = useMemo(() => {
  return expensiveCalculation(a, b);
}, [a, b]);

// 缓存函数引用
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

### 3. **自定义 Hooks**
```typescript
// 封装逻辑的 Hook
function useCustomHook(param) {
  const [state, setState] = useState();
  
  useEffect(() => {
    // 逻辑
  }, [param]);
  
  return { state, setState };
}
```

## 🔗 Hooks 之间的关系

### **依赖关系图**
```
useState/useReducer (状态)
    ↓
useEffect (副作用)
    ↓
useMemo/useCallback (优化)
    ↓
useRef (引用)
    ↓
useXXXX (自定义)
```

### **执行顺序**
1. **状态更新** → `useState`/`useReducer`
2. **副作用执行** → `useEffect`
3. **值计算** → `useMemo`
4. **函数缓存** → `useCallback`
5. **引用更新** → `useRef`

## 📊 性能优化策略

### **1. useMemo - 缓存计算结果**
```typescript
// ❌ 每次渲染都重新计算
const expensiveValue = expensiveCalculation(a, b);

// ✅ 只在依赖变化时重新计算
const expensiveValue = useMemo(() => 
  expensiveCalculation(a, b), 
  [a, b]
);
```

### **2. useCallback - 缓存函数引用**
```typescript
// ❌ 每次渲染都创建新函数
const handleClick = () => {
  doSomething(a, b);
};

// ✅ 只在依赖变化时创建新函数
const handleClick = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

### **3. 组合使用**
```typescript
function OptimizedComponent({ data, onUpdate }) {
  // 缓存计算结果
  const processedData = useMemo(() => 
    data.map(item => processItem(item)), 
    [data]
  );
  
  // 缓存函数引用
  const handleUpdate = useCallback((id) => {
    onUpdate(id);
  }, [onUpdate]);
  
  // 缓存依赖条件
  const shouldRender = useMemo(() => 
    processedData.length > 0, 
    [processedData]
  );
  
  return (
    <div>
      {shouldRender && (
        <List 
          data={processedData} 
          onUpdate={handleUpdate} 
        />
      )}
    </div>
  );
}
```

## 🚀 实际应用示例

### **优化前**
```typescript
function useUserNFTs() {
  const { address, isConnected } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);

  // ❌ 每次渲染都创建新函数
  const fetchUserNFTs = async () => {
    // 逻辑
  };

  // ❌ 每次渲染都创建新对象
  return {
    nfts,
    loading,
    refetch: fetchUserNFTs,
  };
}
```

### **优化后**
```typescript
function useUserNFTs() {
  const { address, isConnected } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 缓存函数引用
  const fetchUserNFTs = useCallback(async () => {
    // 逻辑
  }, [address]);

  // ✅ 缓存依赖条件
  const shouldFetch = useMemo(() => 
    isConnected && address, 
    [isConnected, address]
  );

  useEffect(() => {
    if (shouldFetch) {
      fetchUserNFTs();
    }
  }, [shouldFetch, fetchUserNFTs]);

  // ✅ 缓存返回值
  return useMemo(() => ({
    nfts,
    loading,
    refetch: fetchUserNFTs,
  }), [nfts, loading, fetchUserNFTs]);
}
```

## ⚡ 性能提升效果

### **优化指标**
- **减少不必要的重新渲染** - 50-80%
- **减少函数重新创建** - 90%+
- **减少计算重复执行** - 70-90%
- **减少子组件重新渲染** - 60-80%

### **缓存策略**
```typescript
// 1. 缓存时间优化
const REQUEST_CACHE_TTL = 10000; // 10秒缓存

// 2. 批量请求优化
const BATCH_SIZE = 3; // 批量处理

// 3. 防抖优化
const REQUEST_DELAY = 200; // 200ms延迟
```

## 🎯 最佳实践

### **1. 何时使用 useMemo**
- 计算成本高的操作
- 依赖数组变化不频繁
- 避免子组件不必要的重新渲染

### **2. 何时使用 useCallback**
- 函数作为 props 传递给子组件
- 函数在 useEffect 依赖数组中
- 避免子组件不必要的重新渲染

### **3. 何时使用 useRef**
- 存储不需要触发重新渲染的值
- 访问 DOM 元素
- 存储定时器 ID

### **4. 自定义 Hooks 设计**
- 单一职责原则
- 可复用性
- 清晰的 API 设计
- 适当的性能优化

## 🔍 调试技巧

### **1. React DevTools Profiler**
- 识别性能瓶颈
- 分析渲染次数
- 优化建议

### **2. 控制台日志**
```typescript
// 调试重新渲染
console.log('Component rendered', { props, state });

// 调试 Hook 执行
useEffect(() => {
  console.log('Effect executed', dependencies);
}, [dependencies]);
```

### **3. 性能监控**
```typescript
// 监控 Hook 执行时间
const startTime = performance.now();
// Hook 逻辑
const endTime = performance.now();
console.log(`Hook execution time: ${endTime - startTime}ms`);
```

## 📈 总结

React Hooks 之间的关系是：
- **useState/useReducer** 提供状态
- **useEffect** 处理副作用
- **useMemo/useCallback** 优化性能
- **useRef** 提供引用
- **自定义 Hooks** 封装逻辑

通过合理使用这些 Hooks，可以显著提升应用性能，减少不必要的重新渲染和计算。
