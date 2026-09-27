'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { authFetch, describeError } from '@/lib/api';

interface Complex {
  id: string;
  name: string;
}

interface Ingredient {
  id: string;
  complexId: string;
  name: string;
  unit: string;
  stock: string;
  minStock: string | null;
}

interface RecipeLine {
  id: string;
  ingredientId: string;
  quantityPerUnit: string;
  ingredient: Ingredient;
}

interface Product {
  id: string;
  complexId: string;
  name: string;
  price: string;
  recipe: RecipeLine[];
}

interface StockMovement {
  id: string;
  type: string;
  quantity: string;
  balanceAfter: string;
  note: string | null;
  reference: string | null;
  createdAt: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE: 'Compra',
  SALE_CONSUMPTION: 'Venta',
  ADJUSTMENT: 'Ajuste',
  WASTE: 'Merma',
};

export default function InventoryPage() {
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [complexId, setComplexId] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadIngredients = (cId: string) =>
    authFetch<Ingredient[]>(`/concessions/ingredients?complexId=${cId}`)
      .then(setIngredients)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los insumos')));

  const loadProducts = (cId: string) =>
    authFetch<Product[]>(`/concessions/products?complexId=${cId}`)
      .then(setProducts)
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los productos')));

  useEffect(() => {
    authFetch<Complex[]>('/complexes')
      .then((data) => {
        setComplexes(data);
        if (data[0]) setComplexId(data[0].id);
      })
      .catch((err) => setError(describeError(err, 'No se pudieron cargar los complejos')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!complexId) return;
    loadIngredients(complexId);
    loadProducts(complexId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexId]);

  // --- Insumos ---
  const [ingredientForm, setIngredientForm] = useState({ name: '', unit: 'g', initialStock: '', minStock: '' });
  const handleCreateIngredient = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await authFetch('/concessions/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          complexId,
          name: ingredientForm.name,
          unit: ingredientForm.unit,
          initialStock: ingredientForm.initialStock ? Number(ingredientForm.initialStock) : undefined,
          minStock: ingredientForm.minStock ? Number(ingredientForm.minStock) : undefined,
        }),
      });
      setIngredientForm({ name: '', unit: 'g', initialStock: '', minStock: '' });
      loadIngredients(complexId);
    } catch (err) {
      setError(describeError(err, 'No se pudo crear el insumo'));
    }
  };

  const [movementForm, setMovementForm] = useState({ ingredientId: '', type: 'PURCHASE', quantity: '', note: '' });
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsFor, setMovementsFor] = useState<string | null>(null);

  const handleAdjustStock = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!movementForm.ingredientId) {
      setError('Elige un insumo');
      return;
    }
    try {
      await authFetch(`/concessions/ingredients/${movementForm.ingredientId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          type: movementForm.type,
          quantity: Number(movementForm.quantity),
          note: movementForm.note || undefined,
        }),
      });
      setMessage('Movimiento registrado.');
      setMovementForm((f) => ({ ...f, quantity: '', note: '' }));
      loadIngredients(complexId);
      if (movementsFor === movementForm.ingredientId) viewMovements(movementForm.ingredientId);
    } catch (err) {
      setError(describeError(err, 'No se pudo registrar el movimiento'));
    }
  };

  const viewMovements = (ingredientId: string) => {
    setMovementsFor(ingredientId);
    authFetch<StockMovement[]>(`/concessions/ingredients/${ingredientId}/movements`)
      .then(setMovements)
      .catch((err) => setError(describeError(err, 'No se pudo cargar el kardex')));
  };

  // --- Productos ---
  const [productForm, setProductForm] = useState({ name: '', price: '' });
  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await authFetch('/concessions/products', {
        method: 'POST',
        body: JSON.stringify({ complexId, name: productForm.name, price: Number(productForm.price) }),
      });
      setProductForm({ name: '', price: '' });
      loadProducts(complexId);
    } catch (err) {
      setError(describeError(err, 'No se pudo crear el producto'));
    }
  };

  // --- Receta (BOM) ---
  const [recipeProductId, setRecipeProductId] = useState('');
  const [recipeLines, setRecipeLines] = useState<{ ingredientId: string; quantityPerUnit: string }[]>([]);

  const selectProductForRecipe = (product: Product) => {
    setRecipeProductId(product.id);
    setRecipeLines(
      product.recipe.length > 0
        ? product.recipe.map((r) => ({ ingredientId: r.ingredientId, quantityPerUnit: r.quantityPerUnit }))
        : [{ ingredientId: ingredients[0]?.id ?? '', quantityPerUnit: '' }],
    );
  };

  const handleSaveRecipe = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const items = recipeLines
      .filter((l) => l.ingredientId && l.quantityPerUnit)
      .map((l) => ({ ingredientId: l.ingredientId, quantityPerUnit: Number(l.quantityPerUnit) }));
    if (items.length === 0) {
      setError('Agrega al menos un insumo a la receta');
      return;
    }
    try {
      await authFetch(`/concessions/products/${recipeProductId}/recipe`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      setMessage('Receta guardada — ya se descontará del inventario en cada venta.');
      loadProducts(complexId);
    } catch (err) {
      setError(describeError(err, 'No se pudo guardar la receta'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1>Confitería e inventario</h1>
        <span style={{ fontSize: 14, color: 'var(--black-60)' }}>
          El stock vive en los insumos (BOM/receta): vender un producto descuenta automáticamente lo que su receta
          declare — nunca se lleva el inventario por producto terminado.
        </span>
      </div>

      <div className="card" style={{ display: 'flex', gap: 8 }}>
        <select value={complexId} onChange={(e) => setComplexId(e.target.value)}>
          {complexes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: 13, color: 'var(--success-150)' }}>{message}</p>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Insumos</h2>
        <form onSubmit={handleCreateIngredient} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre (ej. Palomitas)"
            required
            value={ingredientForm.name}
            onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
          />
          <input
            placeholder="Unidad (g, ml, unidad…)"
            required
            value={ingredientForm.unit}
            onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
            style={{ width: 120 }}
          />
          <input
            type="number"
            min={0}
            placeholder="Stock inicial"
            value={ingredientForm.initialStock}
            onChange={(e) => setIngredientForm({ ...ingredientForm, initialStock: e.target.value })}
          />
          <input
            type="number"
            min={0}
            placeholder="Mínimo (opcional)"
            value={ingredientForm.minStock}
            onChange={(e) => setIngredientForm({ ...ingredientForm, minStock: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Agregar insumo
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Stock</th>
              <th>Mínimo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>
                  <span
                    className="badge"
                    style={
                      i.minStock != null && Number(i.stock) <= Number(i.minStock)
                        ? { background: '#fddede', color: '#a01e1e' }
                        : undefined
                    }
                  >
                    {Number(i.stock)} {i.unit}
                  </span>
                </td>
                <td>{i.minStock != null ? `${Number(i.minStock)} ${i.unit}` : '—'}</td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => viewMovements(i.id)}>
                    Ver kardex
                  </button>
                </td>
              </tr>
            ))}
            {ingredients.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay insumos para este complejo.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ borderTop: '1px solid var(--black-10)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Registrar movimiento de inventario</span>
          <form onSubmit={handleAdjustStock} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={movementForm.ingredientId}
              onChange={(e) => setMovementForm({ ...movementForm, ingredientId: e.target.value })}
            >
              <option value="">Insumo…</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <select value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}>
              <option value="PURCHASE">Compra (entrada)</option>
              <option value="ADJUSTMENT">Ajuste por conteo físico</option>
              <option value="WASTE">Merma/daño (salida)</option>
            </select>
            <input
              type="number"
              min={0}
              step="0.001"
              placeholder="Cantidad"
              required
              value={movementForm.quantity}
              onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
              style={{ width: 120 }}
            />
            <input
              placeholder="Nota (opcional)"
              value={movementForm.note}
              onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })}
            />
            <button type="submit" className="btn-secondary">
              Registrar
            </button>
          </form>

          {movementsFor && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--black-60)' }}>
                Kardex — {ingredients.find((i) => i.id === movementsFor)?.name}
              </span>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Saldo</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.createdAt).toLocaleString('es-HN')}</td>
                      <td>{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                      <td style={{ color: Number(m.quantity) < 0 ? '#a01e1e' : 'var(--success-150)' }}>
                        {Number(m.quantity) > 0 ? '+' : ''}
                        {Number(m.quantity)}
                      </td>
                      <td>{Number(m.balanceAfter)}</td>
                      <td>{m.note ?? (m.reference ? `Venta ${m.reference.slice(0, 8)}…` : '—')}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: 'var(--black-60)' }}>
                        Sin movimientos todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Productos</h2>
        <form onSubmit={handleCreateProduct} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nombre (ej. Combo mediano)"
            required
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Precio (L.)"
            required
            value={productForm.price}
            onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            Crear producto
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Receta (BOM)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>L. {Number(p.price).toFixed(2)}</td>
                <td>
                  {p.recipe.length === 0
                    ? 'Sin receta configurada'
                    : p.recipe.map((r) => `${Number(r.quantityPerUnit)} ${r.ingredient.unit} ${r.ingredient.name}`).join(', ')}
                </td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => selectProductForRecipe(p)}>
                    Editar receta
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--black-60)' }}>
                  Todavía no hay productos para este complejo.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {recipeProductId && (
          <div style={{ borderTop: '1px solid var(--black-10)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Receta de {products.find((p) => p.id === recipeProductId)?.name}
            </span>
            <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipeLines.map((line, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={line.ingredientId}
                    onChange={(e) =>
                      setRecipeLines((prev) => prev.map((l, i) => (i === index ? { ...l, ingredientId: e.target.value } : l)))
                    }
                  >
                    <option value="">Insumo…</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Cantidad por unidad vendida"
                    value={line.quantityPerUnit}
                    onChange={(e) =>
                      setRecipeLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantityPerUnit: e.target.value } : l)))
                    }
                    style={{ width: 220 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRecipeLines((prev) => [...prev, { ingredientId: '', quantityPerUnit: '' }])}
                >
                  + Agregar insumo
                </button>
                <button type="submit" className="btn-primary">
                  Guardar receta
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
