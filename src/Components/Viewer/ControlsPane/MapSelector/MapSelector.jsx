import React, { PureComponent } from 'react';

import ApiManager from '../../../../ApiManager';
import ErrorHandler from '../../../../ErrorHandler';

import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';

import './MapSelector.css';
import ViewerUtility from '../../ViewerUtility';

const ADMIN_ATLAS = 'Development';

export class MapSelector extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      maps: [],

      atlasSelect: null,
      mapselect: null,

      selectedAtlas: 'ICCO',
      selectedMap: { id: '6f319b4e-1a39-45d0-b9ca-f2c60dc53831' },
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.user !== prevProps.user) {
      this.getMaps();
    }


  }

  componentDidMount = () => {
    this.getMaps();
  }

  getMaps = async () => {
    ApiManager.get('/account/myMaps', null, this.props.user)
      .then(maps => {
        maps.sort((a, b) => { return a.name.localeCompare(b.name); });

        let urlSelectedMapName = new URLSearchParams(window.location.search).get('map');

        let urlSelectedMap = maps.find(x => x.name === urlSelectedMapName);

        let selectedAtlas = this.state.selectedAtlas;
        if (urlSelectedMap) {
          if (urlSelectedMap.atlases.length > 0) {
            selectedAtlas = urlSelectedMap.atlases[0];
          }
          else {
            selectedAtlas = ADMIN_ATLAS;
          }
        }

        this.setState({ maps: maps, selectedAtlas: selectedAtlas }, () => {
          this.onSelectMap({ target: { value: '6f319b4e-1a39-45d0-b9ca-f2c60dc53831' } })
        });
      })
      .catch(err => {
        ErrorHandler.alert(err);
      });
  }

  onSelectAtlas = (e) => {
    let atlas = e.target.value;

    if (this.state.selectedAtlas === atlas) {
      return;
    }

    this.setState({ selectedAtlas: atlas, selectedMap: { id: '6f319b4e-1a39-45d0-b9ca-f2c60dc53831' }});
  }

  onSelectMap = (e) => {
    
    if (!e.target.value) {
      return;
    }

    let map = this.state.maps.find(x => x.id === e.target.value);

    if (!map) {
      return;
    }

    this.setState({ selectedMap: map });

    if (!map.timestamps || !map.layer) {
      this.getMapMetadata(map)
        .then(() => {
          this.props.onSelectMap(map);
        })
        .catch(err => {
          ErrorHandler.alert(err);
        });
    }
  };

  getMapMetadata = (map) => {
    if (map.metadataLoaded) {
      return Promise.resolve();
    }

    let body = {
      mapId: map.id
    };

    let timestampsPromise = ApiManager.post('/metadata/timestamps', body, this.props.user);
    let tileLayersPromise = ApiManager.post('/metadata/tileLayers', body, this.props.user);
    let polygonLayersPromise = ApiManager.post('/metadata/polygonLayers', body, this.props.user);
    //let customPolygonLayersPromise = ApiManager.post('/geoMessage/customPolygon/layers', body, this.props.user);

    let classesPromise = ApiManager.post('/metadata/classes', body, this.props.user);
    let measurementsPromise = ApiManager.post('/metadata/measurements', body, this.props.user);
    let formsPromise = null;
    if (map.accessLevel >= ApiManager.accessLevels.viewGeoMessages) {
      formsPromise = ApiManager.post('/geomessage/forms/get', body, this.props.user);
    }

    let promises = [
      timestampsPromise,
      tileLayersPromise,
      polygonLayersPromise,
      //customPolygonLayersPromise,

      classesPromise,
      measurementsPromise,
      formsPromise
    ];

    return Promise.all(promises)
      .then(results => {
        map.timestamps = results[0];
        map.layers = {
          tile: results[1],
          polygon: results[2],
          //customPolygon: results[3]
        };

        map.classes = results[3];
        map.measurements = results[4];
        if (results[5]) {
          map.forms = results[5]
        }

        map.metadataLoaded = true;
      })
  }

  renderAtlasSelect = () => {
    let maps = this.state.maps;

    if (!maps || maps.length === 0) {
      return null;
    }

    let options = [];

    let atlases = [];
    let atlasMapCount = {};

    for (let i = 0; i < maps.length; i++) {
      let map = maps[i];

      if (!map.atlases) {
        continue;
      }

      for (let x = 0; x < map.atlases.length; x++) {
        let atlas = map.atlases[x];

        if (!atlases.includes(atlas)) {
          atlases.push(atlas);
        }

        if (!atlasMapCount[atlas]) {
          atlasMapCount[atlas] = 1;
        }
        else {
          atlasMapCount[atlas] += 1;
        }
      }
    }

    atlases.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    let user = this.props.user;

    if (user && (user.username === ViewerUtility.admin || user.username === 'demo_user' || user.username === 'minghai')) {
      atlases.push(ADMIN_ATLAS);
      atlasMapCount[ADMIN_ATLAS] = maps.length;
    }

    for (let i = 0; i < atlases.length; i++) {
      options.push(
        <MenuItem value={atlases[i]} key={i}>{`${atlases[i]} (${atlasMapCount[atlases[i]]})`}</MenuItem>
      );
    }

    let atlasSelect = (
      <Select className='selector map-selector-select' onChange={this.onSelectAtlas} value={this.state.selectedAtlas}>
        <MenuItem value='default' disabled hidden>{this.props.localization['Select an Atlas']}</MenuItem>
        {options}
      </Select>
    );

    return atlasSelect;
  }

  renderMapSelect = () => {
    let maps = this.state.maps;
    let selectedAtlas = this.state.selectedAtlas;

    if (!maps || !selectedAtlas || selectedAtlas === 'default') {
      return null;
    }

    let mapsOfAtlas = maps;
    if (selectedAtlas !== ADMIN_ATLAS) {
      mapsOfAtlas = maps.filter(x => x.atlases.includes(selectedAtlas));
    }

    let options = [];

    for (let i = 0; i < mapsOfAtlas.length; i++) {
      let map = mapsOfAtlas[i];
      options.push(
        <MenuItem value={map.id} key={i}>{map.name}</MenuItem>
      );
    }

    let mapSelect = (
      <Select className='selector' onChange={this.onSelectMap} value={this.state.selectedMap.id}>
        <MenuItem value='default' disabled hidden>{this.props.localization['Select a map']}</MenuItem>
        {options}
      </Select>
    )

    return mapSelect;
  };

  render() {
    return (
      <div>
{/*        {this.renderAtlasSelect()}
        {this.renderMapSelect()}*/}
      </div>
    );
  }
}

export default MapSelector;
