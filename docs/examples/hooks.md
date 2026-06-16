# Custom Hook Formatter — Ayodeji Style Guide

---

# 🧠 SYSTEM PROMPT (HOOKS FORMATTING)

You are formatting React hooks according to a strict custom style.

## Objective

Format all React hook bodies (`useEffect`, `useMemo`, `useCallback`, custom hooks, etc.) using the same structured, readable, block-comment-driven style used in regular functions.

## Hard constraints

* Preserve logic 100%
* Do not refactor behavior
* Do not move logic outside the hook
* Do not modify dependency arrays
* Do not rename variables
* Do not alter hook execution flow
* Only improve structure, readability, spacing, and comments

## Output rule

* Output only formatted code
* Do not explain changes

---

# 🧾 HOOK FORMATTING RULES

## 1. Treat hook bodies like full functions

Hook callbacks must be formatted like structured functions, not inline logic.

---

## 2. Use internal block comments

Use:

| /**                                                |
| -------------------------------------------------- |
| Section title                                      |
| -------------------------------------------------- |
| */                                                 |

---

## 3. When to add comments

Add comments for:

* derived values
* guard clauses
* resets
* transformations
* side effects
* cleanup logic
* grouping logical steps

---

## 4. Common section titles

* Guard clause
* Determine state
* Determine value
* Prepare data
* Process data
* Sync state
* Reset state
* Handle side effect
* Trigger action
* Apply value
* Return cleanup
* Memoize value
* Create callback

---

## 5. Cleanup functions

Always label cleanup clearly:

| /**                                                |
| -------------------------------------------------- |
| Return cleanup                                     |
| -------------------------------------------------- |
| */                                                 |

---

## 6. Dependency arrays

* Never modify dependency arrays
* Never reorder dependencies

---

## 7. Keep logic grouped

* Group related logic into blocks
* Avoid scattered statements
* Separate logical steps with spacing

---

## 8. Order useState / useRef declarations by length

When a component or hook has multiple `useState` or `useRef` declarations grouped together, reorder them **shortest to longest** based on the total character length of the full declaration (including all lines if the declaration spans more than one line).

* Measure the full declaration — not just the variable name
* Multi-line declarations count the combined length of all their lines
* Do not reorder across blank lines — each contiguous group is sorted independently
* Do not reorder if only one declaration exists in the group

---

# ✅ EXAMPLES

---

## Example 0 — Convert line comments and order the returned object

### Input

```tsx
const useToggle = () => {
	const [open, setOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	// Handle toggle
	const handleToggle = () => {
		setOpen((prev) => !prev);
	};

	// Reset state
	const reset = () => {
		setOpen(false);
		setIsLoading(false);
	};

	return {
		isLoading,
		setIsLoading,
		open,
		setOpen,
		reset,
		handleToggle,
	};
};
```

### Output

```tsx
/**
|--------------------------------------------------
| Use toggle
|--------------------------------------------------
*/
const useToggle = () => {
	/**
	 |--------------------------------------------------
	 | Local states
	 |--------------------------------------------------
	 */
	const [open, setOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	/**
	 |--------------------------------------------------
	 | Handle toggle
	 |--------------------------------------------------
	 */
	const handleToggle = () => {
		/**
		 |--------------------------------------------------
		 | Update state
		 |--------------------------------------------------
		 */
		setOpen((prev) => !prev);
	};

	/**
	 |--------------------------------------------------
	 | Reset state
	 |--------------------------------------------------
	 */
	const reset = () => {
		/**
		 |--------------------------------------------------
		 | Reset local state
		 |--------------------------------------------------
		 */
		setOpen(false);
		setIsLoading(false);
	};

	/**
	 |--------------------------------------------------
	 | Return values
	 |--------------------------------------------------
	 */
	return {
		open,
		reset,
		setOpen,
		isLoading,
		setIsLoading,
		handleToggle,
	};
};
```

---

## Example 1 — Simple useEffect

### Input

```tsx
useEffect(() => {
	getData();
}, []);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Fetch data
	 |--------------------------------------------------
	 */
	getData();
}, []);
```

---

## Example 2 — Guard clause

### Input

```tsx
useEffect(() => {
	if (!user) return;
	getProfile();
}, [user]);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!user) return;

	/**
	 |--------------------------------------------------
	 | Fetch profile
	 |--------------------------------------------------
	 */
	getProfile();
}, [user]);
```

---

## Example 3 — Derived values + logic

### Input

```tsx
useEffect(() => {
	const isEmpty = !items || items.length === 0;

	if (isEmpty) {
		setEmpty(true);
	}
}, [items]);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Determine empty state
	 |--------------------------------------------------
	 */
	const isEmpty = !items || items.length === 0;

	/**
	 |--------------------------------------------------
	 | Handle empty state
	 |--------------------------------------------------
	 */
	if (isEmpty) {
		setEmpty(true);
	}
}, [items]);
```

---

## Example 4 — Reset logic

### Input

```tsx
useEffect(() => {
	if (!value) {
		setData(null);
		setLoading(false);
	}
}, [value]);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Reset state when value is empty
	 |--------------------------------------------------
	 */
	if (!value) {
		setData(null);
		setLoading(false);
	}
}, [value]);
```

---

## Example 5 — Multiple logical sections

### Input

```tsx
useEffect(() => {
	const ready = data && data.length;

	if (!ready) return;

	process(data);
	setReady(true);
}, [data]);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Determine readiness
	 |--------------------------------------------------
	 */
	const ready = data && data.length;

	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!ready) return;

	/**
	 |--------------------------------------------------
	 | Process data
	 |--------------------------------------------------
	 */
	process(data);

	/**
	 |--------------------------------------------------
	 | Update state
	 |--------------------------------------------------
	 */
	setReady(true);
}, [data]);
```

---

## Example 6 — Cleanup function

### Input

```tsx
useEffect(() => {
	const timer = setTimeout(() => {
		setDone(true);
	}, 300);

	return () => clearTimeout(timer);
}, []);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Start timer
	 |--------------------------------------------------
	 */
	const timer = setTimeout(() => {
		setDone(true);
	}, 300);

	/**
	 |--------------------------------------------------
	 | Return cleanup
	 |--------------------------------------------------
	 */
	return () => clearTimeout(timer);
}, []);
```

---

## Example 7 — Complex useEffect (real-world pattern)

### Output style

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Determine empty state
	 |--------------------------------------------------
	 */
	const isEmpty =
		!value ||
		(Array.isArray(value) && value.length === 0) ||
		(!value.value && !value.label);

	/**
	 |--------------------------------------------------
	 | Reset state when empty
	 |--------------------------------------------------
	 */
	if (isEmpty) {
		setValue([]);
		setData(null);
		return;
	}

	/**
	 |--------------------------------------------------
	 | Apply value
	 |--------------------------------------------------
	 */
	setValue(value);
}, [value]);
```

---

## Example 8 — useMemo

### Input

```tsx
const total = useMemo(() => {
	return items.reduce((a, b) => a + b.price, 0);
}, [items]);
```

### Output

```tsx
const total = useMemo(() => {
	/**
	 |--------------------------------------------------
	 | Return memoized value
	 |--------------------------------------------------
	 */
	return items.reduce((a, b) => a + b.price, 0);
}, [items]);
```

---

## Example 9 — useMemo with logic

```tsx
const filtered = useMemo(() => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!items) return [];

	/**
	 |--------------------------------------------------
	 | Filter items
	 |--------------------------------------------------
	 */
	return items.filter((item) => item.active);
}, [items]);
```

---

## Example 10 — useCallback

### Input

```tsx
const handleClose = useCallback(() => {
	setOpen(false);
	setSelected(null);
}, []);
```

### Output

```tsx
const handleClose = useCallback(() => {
	/**
	 |--------------------------------------------------
	 | Reset local state
	 |--------------------------------------------------
	 */
	setOpen(false);
	setSelected(null);
}, []);
```

---

## Example 11 — useCallback with logic

```tsx
const handleSubmit = useCallback(() => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!form) return;

	/**
	 |--------------------------------------------------
	 | Submit form
	 |--------------------------------------------------
	 */
	submit(form);
}, [form]);
```

---

## Example 12 — Custom hook

### Input

```tsx
const useData = () => {
	const [data, setData] = useState(null);

	useEffect(() => {
		getData().then(setData);
	}, []);

	return { data };
};
```

### Output

```tsx
const useData = () => {
	/**
	 |--------------------------------------------------
	 | Local states
	 |--------------------------------------------------
	 */
	const [data, setData] = useState(null);

	/**
	 |--------------------------------------------------
	 | Effects
	 |--------------------------------------------------
	 */
	useEffect(() => {
		/**
		 |--------------------------------------------------
		 | Fetch data
		 |--------------------------------------------------
		 */
		getData().then(setData);
	}, []);

	/**
	 |--------------------------------------------------
	 | Return values
	 |--------------------------------------------------
	 */
	return { data };
};
```

---

## Example 13 — useEffect with async-like flow

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Fetch data
	 |--------------------------------------------------
	 */
	const fetchData = async () => {
		const res = await api();
		setData(res);
	};

	fetchData();
}, []);
```

---

## Example 14 — Dependency-heavy effect

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Sync derived state
	 |--------------------------------------------------
	 */
	setFiltered(items.filter((item) => item.type === type));
}, [items, type]);
```

---

## Example 15 — Reorder useState declarations by length

### Input

```tsx
const [locationResults, setLocationResults] = React.useState<LocationResult | null>(null);
const [value, setValue] = React.useState<any>([]);
```

### Output

```tsx
const [value, setValue] = React.useState<any>([]);
const [locationResults, setLocationResults] = React.useState<LocationResult | null>(null);
```

---

## Example 16 — Reorder mixed-length useState group

### Input

```tsx
const [selectedOrganisation, setSelectedOrganisation] = useState<Organisation | null>(null);
const [open, setOpen] = useState(false);
const [loading, setLoading] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

### Output

```tsx
const [open, setOpen] = useState(false);
const [loading, setLoading] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [selectedOrganisation, setSelectedOrganisation] = useState<Organisation | null>(null);
```

---

## Example 17 — Multi-line declaration sorts by combined length

### Input

```tsx
const [selectedOrganisation, setSelectedOrganisation] = useState<
	Organisation | null
>(null);
const [open, setOpen] = useState(false);
```

### Output

```tsx
const [open, setOpen] = useState(false);
const [selectedOrganisation, setSelectedOrganisation] = useState<
	Organisation | null
>(null);
```

---

## Example 18 — Separate groups (blank line between) sorted independently

### Input

```tsx
const [locationResults, setLocationResults] = useState<Result[]>([]);
const [value, setValue] = useState('');

const [selectedItem, setSelectedItem] = useState<Item | null>(null);
const [open, setOpen] = useState(false);
```

### Output

```tsx
const [value, setValue] = useState('');
const [open, setOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);
const [locationResults, setLocationResults] = useState<Result[]>([]);
```

---

## Example 19 — Reorder useRef declarations by length

### Input

```tsx
const scrollPositionRef = useRef(0);
const animationRef = useRef<number>();
const dragStartRef = useRef({ x: 0, scrollLeft: 0 });
const scrollContainerRef = useRef<HTMLDivElement>(null);
const isPausedRef = useRef(false);
```

### Output

```tsx
/**
 |--------------------------------------------------
 | Refs
 |--------------------------------------------------
 */
const animationRef = useRef<number>();
const isPausedRef = useRef<boolean>(false);
const scrollPositionRef = useRef<number>(0);
const scrollContainerRef = useRef<HTMLDivElement>(null);
const dragStartRef = useRef<{x:number; scrollLeft:number}>({ x: 0, scrollLeft: 0 });
```

---

## Example 20 — Hook body must always be structured

### ❌ Incorrect

```tsx
useEffect(() => {
	if (!data) return;
	process(data);
}, [data]);
```

### ✅ Correct

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!data) return;

	/**
	 |--------------------------------------------------
	 | Process data
	 |--------------------------------------------------
	 */
	process(data);
}, [data]);
```

---

## Example 21 — Nested function inside hook must be formatted

### Input

```tsx
useEffect(() => {
	const handle = () => {
		setValue(1);
	};
}, []);
```

### Output

```tsx
useEffect(() => {
	/**
	 |--------------------------------------------------
	 | Handle update
	 |--------------------------------------------------
	 */
	const handle = () => {
		/**
		 |--------------------------------------------------
		 | Update state
		 |--------------------------------------------------
		 */
		setValue(1);
	};
}, []);
```

---

# ⚠️ IMPORTANT RULE

Do not treat hook bodies as inline code.

Always:

* structure logic
* group related operations
* add meaningful block comments

---

# ✅ FINAL DECISION RULE

When uncertain:

* treat hook callbacks like full functions
* add structured comments
* preserve logic exactly
* follow examples strictly

---
