(() => {
  const {
    LEVEL_LABELS,
    createSkillTypeOptions,
    createIndices,
    escapeHtml,
    formatBaseMaterialsText,
    getLevelLabel,
    getMaterialNames,
    getPrimaryRecord,
    getSearchableText,
    getTeamMaterialGroups,
    readStoredArray,
    resolveRecordLabel,
    writeStoredArray
  } = window.ORDApp;

  function renderMaterialsList(level1Items, level0Items) {
    if (level1Items.length === 0 && level0Items.length === 0) {
      return '<span class="muted">無</span>';
    }

    let html = '';
    if (level1Items.length > 0) {
      html += `
        <div class="materials-group">
          <h4 class="materials-subgroup-title" style="margin: 4px 0 8px; font-size: 0.85rem; color: #ffd28a;">角色</h4>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${level1Items
              .map(
                (item) => `
                  <div class="materials-item">
                    <span>${escapeHtml(item.name)}</span>
                    <span class="item-qty">x${item.count}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }
    if (level0Items.length > 0) {
      html += `
        <div class="materials-group" style="margin-top: 12px;">
          <h4 class="materials-subgroup-title" style="margin: 4px 0 8px; font-size: 0.85rem; color: #ffd28a;">特殊物品</h4>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${level0Items
              .map(
                (item) => `
                  <div class="materials-item">
                    <span>${escapeHtml(item.name)}</span>
                    <span class="item-qty">x${item.count}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  function renderTeamSummaryMaterials(level1Items, level0Items) {
    if (level1Items.length === 0 && level0Items.length === 0) {
      return '<div class="muted">無需求材料</div>';
    }

    return [...level1Items, ...level0Items]
      .map(
        (item) => `
          <div class="team-summary-material-item" style="border-left: 3px solid ${item.level === 1 ? 'var(--primary-color)' : 'var(--muted-color)'};">
            <span class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="qty">x${item.count}</span>
          </div>
        `
      )
      .join('');
  }

  function initCompPage(records) {
    const indices = createIndices(records);
    const compSearchInput = document.getElementById('compSearchInput');
    const levelCheckboxGroup = document.getElementById('levelCheckboxGroup');
    const skillTypeCheckboxGroup = document.getElementById('skillTypeCheckboxGroup');
    const compFiltersBody = document.getElementById('compFiltersBody');
    const compSummaryText = document.getElementById('compSummaryText');
    const compCharacterGroups = document.getElementById('compCharacterGroups');
    const selectedTeamList = document.getElementById('selectedTeamList');
    const teamMaterialsList = document.getElementById('teamMaterialsList');
    const analyzeTeamBtn = document.getElementById('analyzeTeamBtn');
    const clearTeamBtn = document.getElementById('clearTeamBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const toggleCompFiltersBtn = document.getElementById('toggleCompFiltersBtn');

    let currentTeamIdx = 0;
    function getTeamStorageKey(idx){
      return `selectedTeamIds_${idx}`;
    }

    //改多組隊伍
    //let selectedTeamIds = readStoredArray(localStorage, 'selectedTeamIds').filter((id) => indices.byCharacterId.has(id));
    let selectedTeamIds = readStoredArray(localStorage, getTeamStorageKey(currentTeamIdx)).filter((id) => indices.byCharacterId.has(id));let checkedLevels = new Set();
    let checkedSkillTypes = new Set();
    let searchKeyword = '';
    let areFiltersCollapsed = localStorage.getItem('compFiltersCollapsed') === 'true';

    function persistSelectedTeam() {
      writeStoredArray(localStorage, getTeamStorageKey(currentTeamIdx), selectedTeamIds);
    }

    function updateFilterCollapseUI() {
      compFiltersBody.classList.toggle('is-hidden', areFiltersCollapsed);
      toggleCompFiltersBtn.setAttribute('aria-expanded', String(!areFiltersCollapsed));
      toggleCompFiltersBtn.textContent = areFiltersCollapsed ? '展開條件' : '收合條件';
    }

    function renderLevelCheckboxes() {
      levelCheckboxGroup.innerHTML = '';
      const sortedLevels = Object.entries(LEVEL_LABELS)
        .map(([level, label]) => ({ level: Number(level), label }))
        .sort((left, right) => left.level - right.level);

      sortedLevels.forEach(({ level, label }) => {
        if(level > 3){ 
            const checkboxLabel = document.createElement('label');
            checkboxLabel.className = 'checkbox-badge';
            checkboxLabel.innerHTML = `
              <input type="checkbox" value="${level}" ${checkedLevels.has(level) ? 'checked' : ''}>
              <span class="checkbox-badge-label badge-${level}">${level}｜${label}</span>
            `;

            const input = checkboxLabel.querySelector('input');
            input.addEventListener('change', () => {
              if (input.checked) {
                checkedLevels.add(level);
              } else {
                checkedLevels.delete(level);
              }
              renderCharactersList();
            });
            levelCheckboxGroup.appendChild(checkboxLabel);
        }
      });
    }

    function renderSkillTypeCheckboxes() {
      skillTypeCheckboxGroup.innerHTML = createSkillTypeOptions()
        .map(
          ({ value, label }) => `
            <label class="checkbox-badge">
              <input type="checkbox" value="${escapeHtml(value)}" ${checkedSkillTypes.has(value) ? 'checked' : ''}>
              <span class="checkbox-badge-label">${escapeHtml(label)}</span>
            </label>
          `
        )
        .join('');

      skillTypeCheckboxGroup.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.checked) {
            checkedSkillTypes.add(input.value);
          } else {
            checkedSkillTypes.delete(input.value);
          }
          renderCharactersList();
        });
      });
    }

    function renderTeamPanel() {
      if (selectedTeamIds.length === 0) {
        selectedTeamList.innerHTML = '<div class="empty-state">尚未選取任何角色。</div>';
      } else {
        selectedTeamList.innerHTML = selectedTeamIds
          .map((id) => {
            const record = indices.byCharacterId.get(id);
            if (!record) {
              return '';
            }

            return `
              <div class="team-member-card">
                <div class="team-member-info">
                  <span class="badge badge-${record.level}" style="min-width: unset;width:56px ; padding: 2px 8px; font-size: 0.75rem;">${getLevelLabel(record.level)}</span>
                  <span class="team-member-name">${escapeHtml(record.name)}</span>
                </div>
                <button class="team-member-remove" data-id="${escapeHtml(id)}" type="button" title="移出隊伍">&times;</button>
              </div>
            `;
          })
          .join('');

        selectedTeamList.querySelectorAll('.team-member-remove').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            selectedTeamIds = selectedTeamIds.filter((id) => id !== button.dataset.id);
            persistSelectedTeam();
            renderTeamPanel();
            renderCharactersList();
          });
        });
      }

      const { level0Items, level1Items } = getTeamMaterialGroups(selectedTeamIds, indices);
      teamMaterialsList.innerHTML = renderMaterialsList(level1Items, level0Items);
    }

    function renderCharactersList() {
      const filteredRecords = indices.records.filter((record) => {
        if (checkedLevels.size > 0 && !checkedLevels.has(record.level)) {
          return false;
        }
        if (checkedSkillTypes.size > 0) {
          const recordSkillTypes = new Set((record.skill_types || []).map(String));
          const hasMatchedSkill = Array.from(checkedSkillTypes).some((skillType) => recordSkillTypes.has(skillType));
          if (!hasMatchedSkill) {
            return false;
          }
        }
        if (searchKeyword) {
          return getSearchableText(record, indices).includes(searchKeyword);
        }
        return true;
      });

      compSummaryText.textContent = `符合條件：${filteredRecords.length} / ${indices.records.length} 筆`;

      if (filteredRecords.length === 0) {
        compCharacterGroups.innerHTML = '<div class="empty-state">沒有符合條件的角色。</div>';
        return;
      }

      const groups = new Map();
      filteredRecords.forEach((record) => {
        if (!groups.has(record.level)) {
          groups.set(record.level, []);
        }
        groups.get(record.level).push(record);
      });

      const sortedLevels = (Array.from(groups.keys()).sort((left, right) => left - right)).filter(lv=> lv > 3);

      compCharacterGroups.innerHTML = sortedLevels
        .map((level) => {
          const groupRecords = groups.get(level);
          const levelLabel = getLevelLabel(level);

          const cardsHtml = groupRecords
            .map((record) => {
              const isSelected = selectedTeamIds.includes(record.character_id);
              const materialsText = record.materials && record.materials.length > 0
                ? record.materials.map((material) => resolveRecordLabel(material.material_id, indices)).join(' + ')
                : '無';

              return `
                <div class="char-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(record.character_id)}">
                  <div class="char-card-checkbox-wrapper">
                    <input type="checkbox" class="char-card-checkbox" ${isSelected ? 'checked' : ''} data-id="${escapeHtml(record.character_id)}">
                  </div>
                  <div class="char-card-content">
                    <div class="char-card-name-row">
                      <span class="char-card-name">${escapeHtml(record.name)}</span>
                      <span class="badge badge-${record.level}" style="min-width: unset;width:56px; padding: 2px 8px; font-size: 0.72rem;">${escapeHtml(levelLabel)}</span>
                    </div>
                    <div class="char-card-materials" title="${escapeHtml(materialsText)}">
                      材料：${escapeHtml(materialsText)}
                    </div>
                    ${record.remark ? `<div class="char-card-remark">${escapeHtml(record.remark)}</div>` : ''}
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <section class="char-group-section">
              <div class="char-group-header">
                <h3 class="char-group-title">
                  <span class="badge badge-${level}" style="min-width: unset;width:56px; padding: 4px 10px; font-size: 0.85rem;">${levelLabel}</span>
                </h3>
                <span class="char-group-count">${groupRecords.length} 個角色</span>
              </div>
              <div class="char-group-grid">
                ${cardsHtml}
              </div>
            </section>
          `;
        })
        .join('');

      compCharacterGroups.querySelectorAll('.char-card').forEach((card) => {
        const id = card.dataset.id;

        const toggleSelect = () => {
          const index = selectedTeamIds.indexOf(id);
          if (index > -1) {
            selectedTeamIds.splice(index, 1);
          } else {
            selectedTeamIds.push(id);
          }
          persistSelectedTeam();
          renderTeamPanel();

          const checkbox = card.querySelector('.char-card-checkbox');
          const isSelectedNow = selectedTeamIds.includes(id);
          card.classList.toggle('selected', isSelectedNow);
          if (checkbox) {
            checkbox.checked = isSelectedNow;
          }
        };

        card.addEventListener('click', (event) => {
          if (event.target.tagName === 'INPUT' || event.target.closest('.char-card-checkbox-wrapper')) {
            return;
          }
          toggleSelect();
        });

        const checkbox = card.querySelector('.char-card-checkbox');
        if (checkbox) {
          checkbox.addEventListener('change', toggleSelect);
        }
      });
    }

    compSearchInput.addEventListener('input', (event) => {
      searchKeyword = event.target.value.trim().toLowerCase();
      renderCharactersList();
    });

    resetFiltersBtn.addEventListener('click', () => {
      compSearchInput.value = '';
      searchKeyword = '';
      checkedLevels.clear();
      checkedSkillTypes.clear();
      levelCheckboxGroup.querySelectorAll('input').forEach((input) => {
        input.checked = false;
      });
      skillTypeCheckboxGroup.querySelectorAll('input').forEach((input) => {
        input.checked = false;
      });
      renderCharactersList();
    });

    toggleCompFiltersBtn.addEventListener('click', () => {
      areFiltersCollapsed = !areFiltersCollapsed;
      localStorage.setItem('compFiltersCollapsed', areFiltersCollapsed ? 'true' : 'false');
      updateFilterCollapseUI();
    });

    clearTeamBtn.addEventListener('click', () => {
      if (selectedTeamIds.length === 0) {
        return;
      }
      if (window.confirm('確定清空目前的隊伍嗎？')) {
        selectedTeamIds = [];
        persistSelectedTeam();
        renderTeamPanel();
        renderCharactersList();
      }
    });

    analyzeTeamBtn.addEventListener('click', () => {
      // if (selectedTeamIds.length === 0) {
      //   window.alert('請先在角色庫中選取角色加入隊伍！');
      //   return;
      // }
      // writeStoredArray(sessionStorage, 'selectedTeamIds', selectedTeamIds);
      window.location.href = 'comp_tree.html';
    });
    // 新增：隊伍分頁切換邏輯
    const teamTabButtons = document.querySelectorAll('.team-tab-btn');
    console.log('teamTabButtons:', teamTabButtons);
    teamTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        // 切換 active 樣式
        teamTabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 更新當前隊伍索引並重新讀取資料
        currentTeamIdx = Number(btn.dataset.teamIdx);
        selectedTeamIds = readStoredArray(localStorage, getTeamStorageKey(currentTeamIdx)).filter((id) => indices.byCharacterId.has(id));
        
        // 重新渲染畫面
        renderTeamPanel();
        renderCharactersList();
      });
    });

    renderLevelCheckboxes();
    renderSkillTypeCheckboxes();
    updateFilterCollapseUI();
    renderTeamPanel();
    renderCharactersList();
  }

  function initCompTreePage(records) {
    const indices = createIndices(records);
    const compTreeGroupTabs = document.getElementById('compTreeGroupTabs');
    const compTreeTabs = document.getElementById('compTreeTabs');
    const compTreeEmptyState = document.getElementById('compTreeEmptyState');
    const compTreeContent = document.getElementById('compTreeContent');
    const compTreeResultTitle = document.getElementById('compTreeResultTitle');
    const compTreeRootSummary = document.getElementById('compTreeRootSummary');
    const compDownwardContainer = document.getElementById('compDownwardContainer');
    const compTreeTeamMaterials = document.getElementById('compTreeTeamMaterials');

    // let selectedTeamIds = readStoredArray(sessionStorage, 'selectedTeamIds').filter((id) => indices.byCharacterId.has(id));
    // if (selectedTeamIds.length === 0) {
    //   compTreeEmptyState.classList.remove('is-hidden');
    //   compTreeContent.classList.add('is-hidden');
    //   return;
    // }

    // compTreeEmptyState.classList.add('is-hidden');
    // compTreeContent.classList.remove('is-hidden');

    // const { level0Items, level1Items } = getTeamMaterialGroups(selectedTeamIds, indices);
    // let activeIndex = 0;
    // 1. 定義讀取 3 個隊伍的 Key
    function getTeamStorageKey(idx) {
      return `selectedTeamIds_${idx}`;
    }

    // 2. 狀態管理
    let currentMainTeamIdx = 0; // 當前選擇的大隊伍 (0, 1, 2)
    let activeIndex = 0;        // 當前大隊伍中被選中的角色索引

    // 宣告目前隊伍的相關資料變數
    let selectedTeamIds = [];
    let level0Items = [];
    let level1Items = [];

    // 3. 更新目前所選隊伍的資料與材料計算
    function updateCurrentTeamData() {
      selectedTeamIds = readStoredArray(localStorage, getTeamStorageKey(currentMainTeamIdx))
        .filter((id) => indices.byCharacterId.has(id));
      
      const materials = getTeamMaterialGroups(selectedTeamIds, indices);
      level0Items = materials.level0Items;
      level1Items = materials.level1Items;
    }

    // 檢查是否有任何一隊有資料
    const hasAnyData = [0, 1, 2].some(idx => 
      readStoredArray(localStorage, getTeamStorageKey(idx)).filter((id) => indices.byCharacterId.has(id)).length > 0
    );

    if (!hasAnyData) {
      compTreeEmptyState.classList.remove('is-hidden');
      compTreeContent.classList.add('is-hidden');
      if (compTreeGroupTabs) compTreeGroupTabs.style.display = 'none';
      return;
    }

    // 確保內容區塊有打開
    compTreeEmptyState.classList.add('is-hidden');
    compTreeContent.classList.remove('is-hidden');

    function renderCompNodeCard(record, options = {}) {
      // const titleMarkup = options.navigateable
      //   ? `<button type="button" class="tree-node-action" data-navigate-character="${escapeHtml(record.character_id)}">${escapeHtml(record.name)}</button>`
      //   : `<strong>${escapeHtml(record.name)}</strong>`;
      const titleMarkup = `<strong>${escapeHtml(record.name)}</strong>`; // 隊伍組成後不須點進角色

      return `
        <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
          <div class="node-title">
            <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
            ${titleMarkup}
            ${record.key_code ? `(${record.key_code})` : ''}
          </div>
          <div class="node-detail">
            <div>材料：${escapeHtml(getMaterialNames(record, indices).join('、') || '無')}</div>
          </div>
        </div>
      `;
    }

    function renderMissingNodeCard(characterId) {
      return `<li><div class="node-card placeholder"><div class="node-title"><strong>${escapeHtml(characterId)}</strong></div><div class="node-detail">查無對應資料</div></div></li>`;
    }

    function renderCompDownwardBranch(record, trailCharacterIds) {
      const nextTrail = new Set(trailCharacterIds);
      nextTrail.add(record.character_id);
      const materials = record.materials || [];

      if (materials.length === 0) {
        return `<li>${renderCompNodeCard(record)}</li>`;
      }

      const childrenMarkup = materials
        .map((material) => {
          const childRecord = getPrimaryRecord(material.material_id, indices);
          if (!childRecord) {
            return renderMissingNodeCard(material.material_id);
          }

          if (nextTrail.has(childRecord.character_id)) {
            return `<li>
              ${renderCompNodeCard(childRecord)}
              <div class="status-line">此節點與上層屬於同一角色 ID，已停止繼續展開避免循環。</div>
            </li>`;
          }

          return renderCompDownwardBranch(childRecord, nextTrail);
        })
        .join('');

      return `
        <li>
          <details class="branch-details">
            <summary class="branch-summary">
              ${renderCompNodeCard(record, { navigateable: true })}
              <span class="branch-toggle-hint">
                <img style="vertical-align: middle" width="25" height="25" src="resource/arrow_drop_down.svg" alt="點擊收合 / 展開">
              </span>
            </summary>
            <ul class="tree-list">${childrenMarkup}</ul>
          </details>
        </li>
      `;
    }

    function renderCompTree(record) {
      compTreeResultTitle.textContent = `${record.name}｜${getLevelLabel(record.level)} | KR: ${escapeHtml(record.kr_name || '')} | EN: ${escapeHtml(record.en_name || '')}`;

      compTreeRootSummary.innerHTML = `
        <div class="tree-card" style="margin-bottom: 12px;">
          <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
            <div class="node-title">
              <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
              ${record.name} ${record.key_code ? `(${record.key_code})` : ''}
            </div>
            <div class="node-detail">
              <div>備註：${escapeHtml(record.remark || '無')}</div>
              <div>總材料：${escapeHtml(formatBaseMaterialsText(record, indices))}</div>
            </div>
          </div>
        </div>
      `;

      const directMaterials = record.materials || [];
      compDownwardContainer.innerHTML = `
        <div class="tree-card">
          ${directMaterials.length === 0
            ? '<div class="empty-state">這個角色沒有可往下的材料。</div>'
            : `<ul class="tree-list">${directMaterials
                .map((material) => {
                  const childRecord = getPrimaryRecord(material.material_id, indices);
                  if (!childRecord) {
                    return renderMissingNodeCard(material.material_id);
                  }

                  return renderCompDownwardBranch(childRecord, new Set([record.character_id]));
                })
                .join('')}</ul>`}
        </div>
      `;
    }

    function renderTabs() {
      compTreeTabs.innerHTML = selectedTeamIds
        .map((id, index) => {
          const record = indices.byCharacterId.get(id);
          if (!record) {
            return '';
          }

          return `
            <button type="button" class="comp-tree-tab-btn ${index === activeIndex ? 'active' : ''}" data-index="${index}">
              <span class="badge badge-${record.level}" style="min-width: unset;width:56px; padding: 2px 6px; font-size: 0.72rem;">${getLevelLabel(record.level)}</span>
              <span>${escapeHtml(record.name)}</span>
            </button>
          `;
        })
        .join('');

      compTreeTabs.querySelectorAll('.comp-tree-tab-btn').forEach((button) => {
        button.addEventListener('click', () => {
          activeIndex = Number(button.dataset.index);
          renderTabs();

          const activeRecord = indices.byCharacterId.get(selectedTeamIds[activeIndex]);
          if (activeRecord) {
            renderCompTree(activeRecord);
          }
        });
      });

      // 更新總材料面版
      compTreeTeamMaterials.innerHTML = renderTeamSummaryMaterials(level1Items, level0Items);
      
      // 預設渲染該隊第一個角色
      const firstRecord = indices.byCharacterId.get(selectedTeamIds[activeIndex]);
      if (firstRecord) {
        renderCompTree(firstRecord);
      }
    }
    // 4. 初始化/切換大隊伍的邏輯
    function switchMainTeam(teamIdx) {
      //console.log(`切換到隊伍 ${teamIdx + 1}`);
      currentMainTeamIdx = teamIdx;
      activeIndex = 0; // 切換隊伍時重置角色選擇到第一個

      // 切換大 Tab 活化狀態
      compTreeGroupTabs.querySelectorAll('.comp-tree-tab-btn').forEach(btn => {
        if (Number(btn.dataset.mainTeamIdx) === currentMainTeamIdx) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      compTreeRootSummary.innerHTML = ''
      compDownwardContainer.innerHTML = ''
      updateCurrentTeamData();
      renderTabs();
    }

    // 綁定大隊伍切換事件
    compTreeGroupTabs.querySelectorAll('[data-main-team-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.mainTeamIdx);
        switchMainTeam(idx);
      });
    });

    function handleCompTreeNavigation(event) {
      const target = event.target.closest('[data-navigate-character]');
      if (!target) {
        return;
      }

      const record = indices.byCharacterId.get(target.dataset.navigateCharacter);
      if (!record) {
        return;
      }

      renderCompTree(record);
      compDownwardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    compDownwardContainer.addEventListener('click', handleCompTreeNavigation);
    let defaultTeamIdx = 0;
    for (let i = 0; i < 3; i++) {
      const savedIds = readStoredArray(localStorage, getTeamStorageKey(i))
        .filter((id) => indices.byCharacterId.has(id));
      if (savedIds.length > 0) {
        defaultTeamIdx = i;
        break; // 找到第一個有資料的隊伍就跳出
      }
    }

    // 依據偵測結果進行預設顯示
    switchMainTeam(defaultTeamIdx);
  }

  window.ORDApp.initCompPage = initCompPage;
  window.ORDApp.initCompTreePage = initCompTreePage;
})();
