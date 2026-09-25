// Divide uma parede em painéis maciços em volta dos vãos (portas/janelas), sem CSG.
// Coordenadas locais da parede: u ao longo do comprimento (0..length), v na altura
// (0..height). Cada vão: { offset, width, sill, height } — offset = distância do início
// da parede até a lateral do vão. O construtor 3D extruda cada painel pela espessura.

const EPS = 1e-6;

export function validateOpenings(wall, openings) {
  const errors = [];
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  sorted.forEach((o, i) => {
    const id = o.id ?? i;
    if (o.width <= 0 || o.height <= 0) errors.push({ id, msg: 'Vão com dimensão nula' });
    if (o.offset < -EPS || o.offset + o.width > wall.length + EPS) errors.push({ id, msg: 'Vão fora dos limites da parede' });
    if (o.sill < -EPS || o.sill + o.height > wall.height + EPS) errors.push({ id, msg: 'Vão mais alto que a parede' });
    const prev = sorted[i - 1];
    if (prev && o.offset < prev.offset + prev.width - EPS) errors.push({ id, msg: `Vão sobrepõe ${prev.id ?? i - 1}` });
  });
  return errors;
}

export function wallPanels(wall, openings = []) {
  const errors = validateOpenings(wall, openings);
  if (errors.length) return { panels: [], errors };

  const panels = [];
  const push = (u0, u1, v0, v1) => {
    if (u1 - u0 > EPS && v1 - v0 > EPS) panels.push({ u0, u1, v0, v1 });
  };
  let u = 0;
  for (const o of [...openings].sort((a, b) => a.offset - b.offset)) {
    push(u, o.offset, 0, wall.height);                         // trecho cheio antes do vão
    push(o.offset, o.offset + o.width, 0, o.sill);             // abaixo do peitoril
    push(o.offset, o.offset + o.width, o.sill + o.height, wall.height); // acima da verga
    u = o.offset + o.width;
  }
  push(u, wall.length, 0, wall.height);
  return { panels, errors };
}
