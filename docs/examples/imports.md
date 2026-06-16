# Custom Import Formatter — Ayodeji Style Guide

---

# 🧠 SYSTEM PROMPT (USE THIS FOR CLAUDE)

You are formatting import statements according to a strict custom style.

## Objective

Reformat all import statements to match the defined grouping, ordering, spacing, and comment structure exactly.

## Hard constraints

* Do not remove imports
* Do not rename imports
* Do not change import paths
* Do not merge or split imports unless explicitly required for formatting consistency
* Only change ordering, grouping, spacing, and comments
* Sort import statements by the total number of characters in the entire import line (including the import keyword, imported identifiers, and the module path), from shortest to longest. Do not sort based on variable names or import paths alone.

## Output rule

* Output only the formatted code
* Do not explain anything

---

# 🧾 IMPORT FORMATTING RULES

## 1. Group imports into sections

Always group imports into these sections in this exact order:

1. Npm imports
2. Custom imports

---

## 2. Section comment format

Each section must start with:

/**
| -------------------------------------------------- |
| Section name                                       |
| -------------------------------------------------- |
*/

---

## 3. Npm imports definition

Includes:

* React
* Next.js
* React Native
* External libraries (e.g., axios, clsx, lucide-react, etc.)

---

## 4. Custom imports definition

Includes:

* Absolute imports (e.g., `@/src/...`)
* Local project files
* Components
* Hooks
* Utilities
* Assets

---

## 5. Ordering inside each group

Sort imports by length of characters starting from the import statment to the variable name to the import path not by variable name.

Example:

```ts
import a from 'axios';
import b from 'clsx';
```

---

## 6. React import rule

React should always appear at the top of the Npm imports.

Example:

```ts
import React from 'react';
```

---

## 7. Destructured imports formatting

Keep destructured imports clean and readable:

### Short

```ts
import { useState } from 'react';
```

### Long

```ts
import {
	View,
	Text,
	Pressable,
} from 'react-native';
```

---

## 8. No mixing groups

Never mix npm imports with custom imports.

---

## 9. Spacing rules

* Add one empty line after each section comment
* No extra empty lines inside a group
* Add one empty line between groups

---

## 10. Preserve import type

Do not modify:

* `type` imports
* `require`
* dynamic imports

---

# ✅ EXAMPLES

---

## Example 1 — Basic grouping

### Input

```ts
import STBText from '@/src/components/STBText';
import React from 'react';
import { View } from 'react-native';
import ScreenWrapper from '@/src/components/ScreenWrapper';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import React from 'react';
import { View } from 'react-native';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import STBText from '@/src/components/STBText';
import ScreenWrapper from '@/src/components/ScreenWrapper';
```

---

## Example 2 — With multiple npm libraries

### Input

```ts
import clsx from 'clsx';
import React from 'react';
import { View } from 'react-native';
import axios from 'axios';
import Button from '@/components/ui/button';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import clsx from 'clsx';
import React from 'react';
import axios from 'axios';
import { View } from 'react-native';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import Button from '@/components/ui/button';
```

---

## Example 3 — Long destructured imports

### Input

```ts
import { View, Text, Pressable, ScrollView } from 'react-native';
import React from 'react';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import {
    View,
	Text,
	Pressable,
	ScrollView,
} from 'react-native';
import React from 'react';
```

---

## Example 4 — Already grouped but unordered

### Input

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { View } from 'react-native';
import React from 'react';
import clsx from 'clsx';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import clsx from 'clsx';
import React from 'react';
import { View } from 'react-native';
```

---

## Example 5 — Mixed imports (common real-world case)

### Input

```ts
import { useState } from 'react';
import STBText from '@/src/components/STBText';
import axios from 'axios';
import ScreenWrapper from '@/src/components/ScreenWrapper';
import React from 'react';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import React from 'react';
import axios from 'axios';
import { useState } from 'react';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import STBText from '@/src/components/STBText';
import ScreenWrapper from '@/src/components/ScreenWrapper';
```

---

## Example 6 — With hooks and UI libs

### Input

```ts
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Pressable, View } from 'react-native';
import Button from '@/components/ui/button';
import TitleHeader from '@/components/TitleHeader';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import Button from '@/components/ui/button';
import TitleHeader from '@/components/TitleHeader';
```

---

## Example 7 — Edge case (only custom imports)

### Input

```ts
import STBText from '@/src/components/STBText';
import ScreenWrapper from '@/src/components/ScreenWrapper';
```

### Output

```ts
/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import STBText from '@/src/components/STBText';
import ScreenWrapper from '@/src/components/ScreenWrapper';
```

---

## Example 8 — Edge case (only npm imports)

### Input

```ts
import React from 'react';
import axios from 'axios';
import clsx from 'clsx';
```

### Output

```ts
/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import clsx from 'clsx';
import React from 'react';
import axios from 'axios';
```

---

# ⚠️ IMPORTANT EDGE RULES

* Reorder named imports inside `{}` as well
* Do not convert default imports to named imports
* Do not modify paths
* Remove unused imports (leave that to linting tools)
* Do not merge separate import statements
* Ensure that the arrangement is based off of the length of characters including the import statement - (Shortest to longest)

---

# ✅ FINAL DECISION RULE

When uncertain:

* group by npm vs custom
* sort alphabetically within each group
* keep React first
* follow examples exactly
* Ensure that the arrangement is based off of the length of characters including the import statement
