/*
## ⚔️ 攻擊與傷害強化

* 전체 공격력 버프 (공증)：全體攻擊力 Buff（增攻）
* 공격속도 버프 (공속)：攻擊速度 Buff（攻速）
* 광폭화 특화 (광폭화)：狂暴化特化（狂暴）
* 마법데미지 증폭 (도킹)：魔法傷害增幅（Docking / 降魔抗增傷）
* 스플래시 데미지 (스플뎀)：濺射傷害 / 擴散傷害（濺射）
* 폭발형 데미지 증폭 (폭발형 증폭)：爆炸型傷害增幅（爆炸增幅）

## 🎯 單體百分比與斬殺傷害

* 단일 적 잃은체력 %데미지 (단일-잃퍼)：單體敵人已損失血量 % 傷害（單體-損血%）
* 단일 적 전체체력 %데미지 (끝딜)：單體敵人總血量 % 傷害（收尾輸出 / 斬殺）
* 단일 적 현재체력 %데미지 (단일)：單體敵人當前血量 % 傷害（單體）

## 💥 範圍百分比傷害

* 범위 적 잃은체력 %데미지 (범퍼-잃퍼)：範圍敵人已損失血量 % 傷害（範圍-損血%）
* 범위 적 전체체력 %데미지 (범퍼-전퍼)：範圍敵人總血量 % 傷害（範圍-總血%）
* 범위 적 현재체력 %데미지 (범퍼-현퍼)：範圍敵人當前血量 % 傷害（範圍-當前%）

## 🛡️ 削弱與穿透效果

* 마법방어력 감소 (마방깍)：減少魔法防禦力（減魔防）
* 방어력 감소 (방깍)：減少防禦力（減防）
* 방어무시 데미지 (방무뎀)：無視防禦傷害（無視防禦）
* 아머브레이크 (암브)：破甲效果（破甲）

## 🛑 控制與異常狀態

* 단일 적 스턴 (단일스턴)：單體敵人暈眩（單體暈）
* 범위스턴 (스턴)：範圍暈眩（暈眩）
* 이동속도 감소 (이감)：減少移動速度（緩速）

## 🗺️ 機動性與特殊機制

* 공중이동 (공중이동)：空中移動（空中移動）
* 순간이동 (순간이동)：瞬間移動 / 閃現（瞬移）
* 보스특화 (보스)：Boss 特化（Boss）
* 유닛삭제 (삭제)：秒殺單位 / 移除單位（秒殺）

## 🧪 恢復與續航

* 마나회복 (마나젠)：魔力回復 / 回魔（回魔）
* 체력회복 (체젠)：生命回復 / 回血（回血）
*/
(() => {
  const app = window.ORDApp || (window.ORDApp = {});

  const LEVEL_LABELS = {
    0: '物品',
    1: '常見',
    2: '不凡',
    3: '特別',
    4: '稀有',
    5: '傳奇',
    6: '隱藏',
    7: '扭曲',
    8: '變化',
    9: '限制',
    10: '超越',
    11: '不朽',
    12: '永恆',
    16: '隨機',
    18: '神秘',
    23: '熾天使',
  };

  const SKILL_TYPE_LABELS = {
    // 攻擊與傷害強化
    'stl-1-1': '全體攻擊力 Buff',
    'stl-1-2': '攻擊速度 Buff',
    'stl-1-3': '狂暴化特化',
    'stl-1-4': '魔法傷害增幅',
    'stl-1-5': '濺射傷害',
    'stl-1-6': '爆炸型傷害增幅',
    // 單體百分比與斬殺傷害
    'stl-2-1': '單體已損失血量 % 傷',
    'stl-2-2': '單體總血量 % 傷',
    'stl-2-3': '單體當前血量 % 傷',
    // 範圍百分比傷害
    'stl-3-1': '範圍已損失血量 % 傷',
    'stl-3-2': '範圍總血量 % 傷',
    'stl-3-3': '範圍當前血量 % 傷',
    // 削弱與穿透效果
    'stl-4-1': '減少魔法防禦',
    'stl-4-2': '減少防禦',
    'stl-4-3': '無視防禦',
    'stl-4-4': '破甲',
    // 控制與異常狀態
    'stl-5-1': '單體暈',
    'stl-5-2': '範圍暈',
    'stl-5-3': '緩速',
    // 機動性與特殊機制
    'stl-6-1': '空中移動',
    'stl-6-2': '瞬移',
    'stl-6-3': 'Boss 特化',
    'stl-6-4': '秒殺單位',
    // 恢復與續航
    'stl-7-1': '魔力回復',
    'stl-7-2': '生命回復',
  }
  

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data || []));
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[·．\.\-–—_]/g, '')
      .replace(/[\s'"]/g, '')
      .replace(/[()（）\[\]【】]/g, '')
      .replace(/[+,，、/]/g, '')
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function compareRecords(left, right) {
    if (left.level !== right.level) {
      return Number(left.level || 0) - Number(right.level || 0);
    }

    const levelCompare = String(left.character_id || '').localeCompare(
      String(right.character_id || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );

    if (levelCompare !== 0) {
      return levelCompare;
    }

    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hant');
  }

  function getLevelLabel(level) {
    return LEVEL_LABELS[level] || `Lv.${level}`;
  }

  function createIndices(records) {
    const sortedRecords = [...records].sort(compareRecords);
    const byCharacterId = new Map();
    const byName = new Map();
    const parentMap = new Map();

    sortedRecords.forEach((record) => {
      byCharacterId.set(record.character_id, record);

      const normalizedName = normalizeText(record.name);
      if (normalizedName && !byName.has(normalizedName)) {
        byName.set(normalizedName, record);
      }

      (record.materials || []).forEach((material) => {
        const materialId = material.material_id;
        if (!parentMap.has(materialId)) {
          parentMap.set(materialId, []);
        }
        parentMap.get(materialId).push(record);
      });
    });

    return {
      records: sortedRecords,
      byCharacterId,
      byName,
      parentMap
    };
  }

  function getPrimaryRecord(characterId, indices) {
    return indices.byCharacterId.get(characterId) || null;
  }

  function resolveRecordLabel(characterId, indices) {
    const record = getPrimaryRecord(characterId, indices);
    return record ? record.name : characterId;
  }

  function getMaterialNames(record, indices) {
    return (record.materials || []).map((material) => resolveRecordLabel(material.material_id, indices));
  }

  function getSkillTypeLabel(skillType) {
    return SKILL_TYPE_LABELS[skillType] || skillType;
  }

  function getSkillTypeLabels(skillTypes) {
    return (skillTypes || []).map((skillType) => getSkillTypeLabel(skillType));
  }

  function createSkillTypeOptions() {
    return Object.entries(SKILL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  }

  function getSearchableText(record, indices) {
    return [
      record.character_id,
      record.name,
      record.kr_name,
      record.en_name,
      record.key_code,
      record.remark,
      record.major,
      getLevelLabel(record.level),
      ...getMaterialNames(record, indices),
      ...(record.skill_types || []),
      ...getSkillTypeLabels(record.skill_types),
      ...(record.suitable_partners || []).map((partner) => resolveRecordLabel(partner.character_id, indices))
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function fillLevelSelect(select, includeAllLabel) {
    const levels = Object.entries(LEVEL_LABELS)
      .map(([level, label]) => ({ level: Number(level), label }))
      .sort((left, right) => left.level - right.level);

    select.innerHTML = '';
    if (includeAllLabel) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = includeAllLabel;
      select.appendChild(option);
    }

    levels.forEach(({ level, label }) => {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = `${level}｜${label}`;
      select.appendChild(option);
    });
  }

  function markActiveNav() {
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('active', link.dataset.page === page);
    });
  }

  function showToast(element, type, message) {
    element.className = `toast ${type}`;
    element.textContent = message;
  }

  function clearToast(element) {
    element.className = 'toast';
    element.textContent = '';
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function readQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function createTomSelectOptions(records) {
    return [...records]
      .sort(compareRecords)
      .map((record) => ({
        value: record.character_id,
        text: record.name,
        label: record.name,
        levelLabel: getLevelLabel(record.level),
        kr_name: record.kr_name || '',
        en_name: record.en_name || '',
        character_id: record.character_id
      }));
  }

  function createTomSelectRenderConfig() {
    return {
      option(data, escape) {
        return `
          <div>
            <div>${escape(data.label || data.text || data.value)}</div>
            <div class="picker-result-meta">${escape(data.character_id || '')}｜${escape(data.levelLabel || '')}${data.kr_name ? `｜KR：${escape(data.kr_name)}` : ''}</div>
          </div>
        `;
      },
      item(data, escape) {
        return `<div>${escape(data.label || data.text || data.value)}</div>`;
      }
    };
  }

  // 遞迴往下拆解，僅把最基礎的素材累加起來，供合成樹與隊伍分析共用。
  function getBaseMaterialQuantities(record, indices, counts = new Map(), visited = new Set()) {
    if (!record) {
      return counts;
    }

    if (visited.has(record.character_id)) {
      return counts;
    }
    visited.add(record.character_id);

    if (record.level === 0 || record.level === 1) {
      const currentCount = counts.get(record.character_id) || 0;
      counts.set(record.character_id, currentCount + 1);
      visited.delete(record.character_id);
      return counts;
    }

    (record.materials || []).forEach((material) => {
      const childRecord = indices.byCharacterId.get(material.material_id);
      if (childRecord) {
        getBaseMaterialQuantities(childRecord, indices, counts, visited);
      } else {
        const currentCount = counts.get(material.material_id) || 0;
        counts.set(material.material_id, currentCount + 1);
      }
    });

    visited.delete(record.character_id);
    return counts;
  }

  function formatBaseMaterialsText(record, indices) {
    const countsMap = getBaseMaterialQuantities(record, indices);
    if (countsMap.size === 0) {
      return '無基礎材料';
    }

    const resultSegments = [];
    countsMap.forEach((count, characterId) => {
      const childRecord = indices.byCharacterId.get(characterId);
      const name = childRecord ? childRecord.name : characterId;
      resultSegments.push(`${name} * ${count}`);
    });

    return resultSegments.join(' + ');
  }

  function readStoredArray(storage, key) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeStoredArray(storage, key, values) {
    storage.setItem(key, JSON.stringify(values));
  }

  function getTeamMaterialGroups(selectedTeamIds, indices) {
    const totalCounts = new Map();
    selectedTeamIds.forEach((characterId) => {
      const record = indices.byCharacterId.get(characterId);
      if (record) {
        getBaseMaterialQuantities(record, indices, totalCounts);
      }
    });

    const level0Items = [];
    const level1Items = [];

    totalCounts.forEach((count, characterId) => {
      const record = indices.byCharacterId.get(characterId);
      const item = {
        id: characterId,
        name: record ? record.name : characterId,
        count,
        level: record ? record.level : 0
      };

      if (item.level === 1) {
        level1Items.push(item);
      } else if (item.level === 0) {
        level0Items.push(item);
      }
    });

    level1Items.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));
    level0Items.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));

    return { totalCounts, level0Items, level1Items };
  }

  function setCanMaintain(value) {
    localStorage.setItem('canMaintain', value ? 'true' : 'false');
  }

  function getIfCanMaintain() {
    return localStorage.getItem('canMaintain') === 'true';
  }

  function showMaintenanceNav() {
    if (!getIfCanMaintain()) {
      return;
    }

    const navLink = document.querySelector('.nav-link[data-page="maintenance"]');
    if (navLink) {
      navLink.style.display = 'block';
    }
  }

  Object.assign(app, {
    LEVEL_LABELS,
    SKILL_TYPE_LABELS,
    cloneData,
    normalizeText,
    escapeHtml,
    compareRecords,
    getLevelLabel,
    createIndices,
    getPrimaryRecord,
    resolveRecordLabel,
    getMaterialNames,
    getSkillTypeLabel,
    getSkillTypeLabels,
    createSkillTypeOptions,
    getSearchableText,
    fillLevelSelect,
    markActiveNav,
    showToast,
    clearToast,
    downloadTextFile,
    readQueryParam,
    createTomSelectOptions,
    createTomSelectRenderConfig,
    getBaseMaterialQuantities,
    formatBaseMaterialsText,
    readStoredArray,
    writeStoredArray,
    getTeamMaterialGroups,
    setCanMaintain,
    getIfCanMaintain,
    showMaintenanceNav
  });

  // 保留舊的全域入口，避免既有書籤或手動 console 操作失效。
  window.setCanMaintain = setCanMaintain;
  window.getIfCanMaintain = getIfCanMaintain;
})();
