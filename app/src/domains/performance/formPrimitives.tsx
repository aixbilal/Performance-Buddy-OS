/**
 * Batch 2A: these primitives were promoted to `src/components/FormFields.tsx`
 * (they were already domain-neutral). This file is a thin re-export so existing
 * Batch 1 imports (`./formPrimitives`) keep working — ONE implementation, no
 * clone. New code should import from `../../components/FormFields`.
 */
export { TextField, TextArea, SelectField } from "../../components/FormFields";
