const form = document.querySelector('#resumeForm');
const experienceFields = document.querySelector('#experienceFields');
const experienceTemplate = document.querySelector('#experienceTemplate');
const previewExperiences = document.querySelector('#previewExperiences');
const previewModal = document.querySelector('#previewModal');
const toast = document.querySelector('#toast');
const saveState = document.querySelector('#saveState');
const textFields = [
  'name', 'gender', 'birthDate', 'phone', 'maritalStatus', 'education', 'school',
  'hukou', 'idNumber', 'address', 'emergencyName', 'emergencyPhone',
  'insuranceDate', 'insuranceMonths', 'disabilityType', 'disabilityLevel',
  'disabilityId', 'signature'
];
let photoData = '';
let saveTimer;

const emptyValue = '—';
const formatDate = value => {
  if (!value) return emptyValue;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? emptyValue : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

const formatMonth = value => {
  const match = /^(\d{4})-(\d{2})/.exec(value || '');
  return match ? `${match[1]}年${Number(match[2])}月` : emptyValue;
};

const getAge = value => {
  if (!value) return emptyValue;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return emptyValue;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDifference = now.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? `${age} 岁` : emptyValue;
};

const escapeHtml = value => String(value || emptyValue)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const readFields = () => Object.fromEntries(textFields.map(name => [name, form.elements[name].value.trim()]));

const getExperiences = () => [...document.querySelectorAll('.experience-entry')]
  .map(item => ({
    period: item.querySelector('.experience-period').value.trim(),
    company: item.querySelector('.experience-company').value.trim(),
    role: item.querySelector('.experience-role').value.trim()
  }))
  .filter(item => item.period || item.company || item.role);

const updateOutput = (key, value) => document.querySelectorAll(`[data-output="${key}"]`).forEach(element => {
  element.textContent = value || emptyValue;
});

function saveDraft() {
  const draft = { fields: readFields(), experiences: getExperiences(), consent: form.elements.consent.checked };
  localStorage.setItem('qixinResumeDraft', JSON.stringify(draft));
  saveState.textContent = '已自动保存';
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { saveState.textContent = '自动保存中'; }, 1000);
}

function refreshExperiences() {
  const entries = [...document.querySelectorAll('.experience-entry')];
  entries.forEach((entry, index) => { entry.querySelector('.experience-number').textContent = index + 1; });
  const content = getExperiences();
  previewExperiences.innerHTML = content.length
    ? content.map(item => `<p><strong>${escapeHtml(item.company || '工作单位')}${item.role ? ` · ${escapeHtml(item.role)}` : ''}</strong>${escapeHtml(item.period || '起止时间待填写')}</p>`).join('')
    : '<p class="empty-experience">暂未填写工作经历</p>';
}

function refresh() {
  const data = readFields();
  Object.entries(data).forEach(([key, value]) => {
    const displayValue = key === 'birthDate' ? formatDate(value) : key === 'insuranceDate' ? formatMonth(value) : value;
    updateOutput(key, displayValue);
  });
  updateOutput('age', getAge(data.birthDate));
  document.querySelector('#resumeDate').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  refreshExperiences();
  saveDraft();
}

function addExperience(values = {}) {
  const entry = experienceTemplate.content.firstElementChild.cloneNode(true);
  entry.querySelector('.experience-period').value = values.period || '';
  entry.querySelector('.experience-company').value = values.company || '';
  entry.querySelector('.experience-role').value = values.role || '';
  entry.querySelector('.remove-experience').addEventListener('click', () => {
    entry.remove();
    refresh();
  });
  experienceFields.append(entry);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2500);
}

function openPreview() {
  refresh();
  previewModal.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('[data-close-modal]').focus();
}

function closePreview() {
  previewModal.hidden = true;
  document.body.style.overflow = '';
}

const pdfLayout = {
  width: 1440,
  height: 2037,
  marginX: 110,
  marginTop: 110,
  marginBottom: 125,
  green: '#176b5b',
  ink: '#172422',
  muted: '#52615a',
  paper: '#fffefa',
  line: '#d8dfd9',
  label: '#f2f5f1'
};

function setCanvasFont(ctx, weight, size) {
  ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
}

function wrapCanvasText(ctx, value, maxWidth) {
  const text = String(value || emptyValue);
  const lines = [];
  let line = '';
  for (const character of text) {
    if (character === '\n') {
      lines.push(line || ' ');
      line = '';
    } else if (ctx.measureText(line + character).width > maxWidth && line) {
      lines.push(line);
      line = character;
    } else {
      line += character;
    }
  }
  lines.push(line || ' ');
  return lines;
}

function drawCanvasLines(ctx, lines, x, y, lineHeight, color = pdfLayout.ink) {
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function createPdfPage(isContinuation = false) {
  const canvas = document.createElement('canvas');
  canvas.width = pdfLayout.width;
  canvas.height = pdfLayout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = pdfLayout.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = pdfLayout.green;
  ctx.fillRect(0, 0, canvas.width, 10);

  let y = pdfLayout.marginTop;
  if (isContinuation) {
    setCanvasFont(ctx, '700', 27);
    ctx.fillStyle = pdfLayout.ink;
    ctx.textBaseline = 'top';
    ctx.fillText('残疾人求职简历（续）', pdfLayout.marginX, y);
    y += 54;
    ctx.fillStyle = pdfLayout.green;
    ctx.fillRect(pdfLayout.marginX, y, pdfLayout.width - pdfLayout.marginX * 2, 3);
    y += 40;
  }
  return { canvas, ctx, y };
}

function drawOneInchPhoto(ctx, image) {
  const photoWidth = 171;
  const photoHeight = 240;
  const x = pdfLayout.width - pdfLayout.marginX - photoWidth;
  const y = pdfLayout.marginTop;
  ctx.fillStyle = '#f5f7f2';
  ctx.fillRect(x, y, photoWidth, photoHeight);
  ctx.strokeStyle = '#c6d1ca';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, photoWidth, photoHeight);

  if (image) {
    const sourceRatio = image.width / image.height;
    const targetRatio = photoWidth / photoHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.width;
    let sourceHeight = image.height;
    if (sourceRatio > targetRatio) {
      sourceWidth = image.height * targetRatio;
      sourceX = (image.width - sourceWidth) / 2;
    } else {
      sourceHeight = image.width / targetRatio;
      sourceY = (image.height - sourceHeight) / 2;
    }
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, photoWidth, photoHeight);
  } else {
    setCanvasFont(ctx, '400', 22);
    ctx.fillStyle = '#99a59e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('照片', x + photoWidth / 2, y + photoHeight / 2);
    ctx.textAlign = 'left';
  }
}

function drawFirstPageHeader(page, photo) {
  const { ctx } = page;
  const x = pdfLayout.marginX;
  let y = pdfLayout.marginTop + 10;
  setCanvasFont(ctx, '700', 18);
  ctx.fillStyle = pdfLayout.green;
  ctx.textBaseline = 'top';
  ctx.fillText('PERSONAL RESUME', x, y);
  y += 40;
  setCanvasFont(ctx, '700', 48);
  ctx.fillStyle = pdfLayout.ink;
  ctx.fillText('残疾人求职简历', x, y);
  drawOneInchPhoto(ctx, photo);
  page.y = pdfLayout.marginTop + 282;
}

function loadPhotoImage() {
  if (!photoData) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = photoData;
  });
}

function renderResumeCanvases(data, experiences, photo) {
  const pages = [];
  let page = createPdfPage();
  pages.push(page);
  drawFirstPageHeader(page, photo);
  const contentWidth = pdfLayout.width - pdfLayout.marginX * 2;

  const newPage = () => {
    page = createPdfPage(true);
    pages.push(page);
  };
  const ensureSpace = height => {
    if (page.y + height > pdfLayout.height - pdfLayout.marginBottom) newPage();
  };
  const drawSection = title => {
    ensureSpace(68);
    const { ctx } = page;
    setCanvasFont(ctx, '700', 25);
    ctx.fillStyle = pdfLayout.ink;
    ctx.textBaseline = 'top';
    ctx.fillText(title, pdfLayout.marginX, page.y);
    page.y += 37;
    ctx.fillStyle = pdfLayout.green;
    ctx.fillRect(pdfLayout.marginX, page.y, contentWidth, 4);
    page.y += 22;
  };
  const drawInfoRow = cells => {
    const cellWidth = contentWidth / cells.length;
    const prepared = cells.map(([label, value]) => {
      const labelWidth = cells.length === 1 ? 190 : 145;
      setCanvasFont(page.ctx, '400', 21);
      const lines = wrapCanvasText(page.ctx, value, cellWidth - labelWidth - 30);
      return { label, labelWidth, lines };
    });
    const rowHeight = Math.max(58, ...prepared.map(item => item.lines.length * 30 + 24));
    ensureSpace(rowHeight);
    prepared.forEach((item, index) => {
      const x = pdfLayout.marginX + index * cellWidth;
      const { ctx } = page;
      ctx.fillStyle = pdfLayout.label;
      ctx.fillRect(x, page.y, item.labelWidth, rowHeight);
      ctx.strokeStyle = pdfLayout.line;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, page.y, cellWidth, rowHeight);
      setCanvasFont(ctx, '700', 19);
      ctx.fillStyle = pdfLayout.muted;
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + 15, page.y + rowHeight / 2);
      setCanvasFont(ctx, '400', 21);
      drawCanvasLines(ctx, item.lines, x + item.labelWidth + 16, page.y + 13, 30);
    });
    page.y += rowHeight;
  };
  const drawInfoRows = rows => rows.forEach(drawInfoRow);
  const drawExperienceHeader = () => {
    const columns = [82, 230, 440, 468];
    const labels = ['序号', '起止时间', '工作单位', '职务 / 岗位'];
    ensureSpace(54);
    let x = pdfLayout.marginX;
    const { ctx } = page;
    columns.forEach((width, index) => {
      ctx.fillStyle = pdfLayout.label;
      ctx.fillRect(x, page.y, width, 52);
      ctx.strokeStyle = pdfLayout.line;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, page.y, width, 52);
      setCanvasFont(ctx, '700', 18);
      ctx.fillStyle = pdfLayout.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[index], x + width / 2, page.y + 26);
      x += width;
    });
    ctx.textAlign = 'left';
    page.y += 52;
  };
  const drawExperienceRow = (experience, index) => {
    const columns = [82, 230, 440, 468];
    const values = [String(index + 1), experience.period || emptyValue, experience.company || emptyValue, experience.role || emptyValue];
    setCanvasFont(page.ctx, '400', 20);
    const lines = values.map((value, columnIndex) => wrapCanvasText(page.ctx, value, columns[columnIndex] - 24));
    const rowHeight = Math.max(58, ...lines.map(item => item.length * 29 + 22));
    if (page.y + rowHeight > pdfLayout.height - pdfLayout.marginBottom) {
      newPage();
      drawSection('工作经历（续）');
      drawExperienceHeader();
    }
    let x = pdfLayout.marginX;
    const { ctx } = page;
    columns.forEach((width, columnIndex) => {
      ctx.strokeStyle = pdfLayout.line;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, page.y, width, rowHeight);
      setCanvasFont(ctx, '400', 20);
      if (columnIndex === 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = pdfLayout.ink;
        ctx.fillText(values[columnIndex], x + width / 2, page.y + rowHeight / 2);
        ctx.textAlign = 'left';
      } else {
        drawCanvasLines(ctx, lines[columnIndex], x + 12, page.y + 12, 29);
      }
      x += width;
    });
    page.y += rowHeight;
  };

  drawSection('基本信息');
  drawInfoRows([
    [['姓名', data.name], ['性别', data.gender]],
    [['出生日期', formatDate(data.birthDate)], ['年龄', getAge(data.birthDate)]],
    [['联系电话', data.phone], ['婚姻状态', data.maritalStatus]],
    [['学历', data.education], ['毕业院校', data.school]],
    [['户籍', data.hukou]],
    [['身份证号', data.idNumber]],
    [['现居住地址', data.address]]
  ]);

  drawSection('联系与参保信息');
  drawInfoRows([
    [['紧急联系人', data.emergencyName], ['联系电话', data.emergencyPhone]],
    [['首次参保年月', formatMonth(data.insuranceDate)], ['参保累计月数', data.insuranceMonths ? `${data.insuranceMonths} 月` : emptyValue]]
  ]);

  drawSection('残疾信息');
  drawInfoRows([
    [['残疾类型', data.disabilityType], ['残疾等级', data.disabilityLevel]],
    [['残疾证号', data.disabilityId]]
  ]);

  drawSection('工作经历');
  drawExperienceHeader();
  if (experiences.length) experiences.forEach(drawExperienceRow);
  else drawExperienceRow({}, 0);

  const promise = '本人承诺以上信息真实有效，如有不实，愿承担相应责任。';
  setCanvasFont(page.ctx, '400', 19);
  const promiseLines = wrapCanvasText(page.ctx, promise, contentWidth);
  const footerHeight = promiseLines.length * 28 + 104;
  ensureSpace(footerHeight);
  const { ctx } = page;
  ctx.strokeStyle = pdfLayout.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pdfLayout.marginX, page.y + 18);
  ctx.lineTo(pdfLayout.marginX + contentWidth, page.y + 18);
  ctx.stroke();
  drawCanvasLines(ctx, promiseLines, pdfLayout.marginX, page.y + 38, 28, pdfLayout.muted);
  setCanvasFont(ctx, '400', 20);
  ctx.fillStyle = pdfLayout.muted;
  ctx.textBaseline = 'top';
  ctx.fillText('申请人签字（电子签名）：', pdfLayout.marginX, page.y + 38 + promiseLines.length * 28 + 30);
  setCanvasFont(ctx, '400', 25);
  ctx.fillStyle = pdfLayout.ink;
  ctx.fillText(data.signature || emptyValue, pdfLayout.marginX + 250, page.y + 38 + promiseLines.length * 28 + 24);
  setCanvasFont(ctx, '400', 20);
  ctx.fillStyle = pdfLayout.muted;
  ctx.fillText(`日期：${new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}`, pdfLayout.marginX + 720, page.y + 38 + promiseLines.length * 28 + 30);

  pages.forEach((item, index) => {
    const pageNumber = `${index + 1} / ${pages.length}`;
    setCanvasFont(item.ctx, '400', 16);
    item.ctx.fillStyle = '#819088';
    item.ctx.textAlign = 'right';
    item.ctx.textBaseline = 'bottom';
    item.ctx.fillText(pageNumber, pdfLayout.width - pdfLayout.marginX, pdfLayout.height - 44);
    item.ctx.textAlign = 'left';
  });
  return pages.map(item => item.canvas);
}

function canvasToJpegBytes(canvas) {
  const base64 = canvas.toDataURL('image/jpeg', 0.94).split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function buildPdfBlob(canvases) {
  const encoder = new TextEncoder();
  const images = canvases.map(canvasToJpegBytes);
  const objectCount = 2 + images.length * 3;
  const offsets = Array(objectCount + 1).fill(0);
  const chunks = [];
  let length = 0;
  const pushBytes = bytes => { chunks.push(bytes); length += bytes.length; };
  const pushText = text => pushBytes(encoder.encode(text));
  const object = (number, body) => {
    offsets[number] = length;
    pushText(`${number} 0 obj\n${body}\nendobj\n`);
  };

  pushText('%PDF-1.3\n%');
  pushBytes(new Uint8Array([226, 227, 207, 211, 10]));
  const pageObjectNumbers = images.map((_, index) => 3 + index * 3);
  object(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  object(2, `<< /Type /Pages /Kids [${pageObjectNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${images.length} >>`);

  images.forEach((imageBytes, index) => {
    const pageObject = pageObjectNumbers[index];
    const contentObject = pageObject + 1;
    const imageObject = pageObject + 2;
    const content = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
    object(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    object(contentObject, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    offsets[imageObject] = length;
    pushText(`${imageObject} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pdfLayout.width} /Height ${pdfLayout.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`);
    pushBytes(imageBytes);
    pushText('\nendstream\nendobj\n');
  });

  const xrefOffset = length;
  pushText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach(offset => pushText(`${String(offset).padStart(10, '0')} 00000 n \n`));
  pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

function triggerPdfDownload(blob, name) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadResume() {
  if (!form.reportValidity()) {
    notify('请先完成所有必填信息，并确认电子承诺');
    return;
  }
  try {
    notify('正在生成 PDF，请稍候…');
    await new Promise(resolve => window.setTimeout(resolve, 20));
    refresh();
    const data = readFields();
    const photo = await loadPhotoImage();
    const canvases = renderResumeCanvases(data, getExperiences(), photo);
    const pdf = buildPdfBlob(canvases);
    const safeName = (data.name || '求职者').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
    triggerPdfDownload(pdf, `${safeName}_求职简历.pdf`);
    notify('PDF 简历已生成，正在保存到下载文件夹');
  } catch (error) {
    console.error('PDF export failed:', error);
    notify('PDF 生成失败，请稍后重试');
  }
}

document.querySelector('#addExperience').addEventListener('click', () => {
  addExperience();
  refresh();
});
document.querySelector('#previewButton').addEventListener('click', openPreview);
document.querySelector('#previewTop').addEventListener('click', openPreview);
document.querySelector('#downloadButton').addEventListener('click', downloadResume);
document.querySelector('#modalDownload').addEventListener('click', downloadResume);
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closePreview));
form.addEventListener('input', refresh);
form.addEventListener('change', refresh);
form.addEventListener('reset', () => {
  window.setTimeout(() => {
    localStorage.removeItem('qixinResumeDraft');
    photoData = '';
    document.querySelector('#previewPhoto').textContent = '照片';
    experienceFields.innerHTML = '';
    addExperience();
    refresh();
  }, 0);
});
document.querySelector('#photo').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return notify('请上传图片文件');
  const reader = new FileReader();
  reader.onload = () => {
    photoData = reader.result;
    document.querySelector('#previewPhoto').innerHTML = `<img src="${photoData}" alt="证件照">`;
    notify('照片已更新');
  };
  reader.readAsDataURL(file);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !previewModal.hidden) closePreview(); });

try {
  const savedDraft = JSON.parse(localStorage.getItem('qixinResumeDraft'));
  const fields = savedDraft?.fields || savedDraft;
  if (fields) {
    Object.entries(fields).forEach(([key, value]) => {
      if (textFields.includes(key)) form.elements[key].value = value || '';
    });
    form.elements.consent.checked = Boolean(savedDraft?.consent || savedDraft?.consent === 'on');
  }
  const savedExperiences = savedDraft?.experiences;
  if (Array.isArray(savedExperiences) && savedExperiences.length) savedExperiences.forEach(addExperience);
  else addExperience();
} catch (_) {
  addExperience();
}

refresh();
