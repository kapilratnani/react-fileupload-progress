'use strict';

import { EventEmitter } from 'events';
import React from 'react';
import ReactDom from 'react-dom';
import objectAssign from 'object-assign';

const styles = {
  progressWrapper: {
    height: '10px',
    marginTop: '10px',
    width: '400px',
    float: 'left',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    WebkitBoxShadow: 'inset 0 1px 2px rgba(0,0,0,.1)',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,.1)',
  },
  progressBar: {
    float: 'left',
    width: '0',
    height: '100%',
    fontSize: '12px',
    lineHeight: '20px',
    color: '#fff',
    textAlign: 'center',
    backgroundColor: '#337ab7',
    WebkitBoxShadow: 'inset 0 -1px 0 rgba(0,0,0,.15)',
    boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.15)',
    WebkitTransition: 'width .6s ease',
    Otransition: 'width .6s ease',
    transition: 'width .6s ease',
  },
  cancelButton: {
    marginTop: '5px',
    WebkitAppearance: 'none',
    padding: 0,
    cursor: 'pointer',
    background: '0 0',
    border: 0,
    float: 'left',
    fontSize: '21px',
    fontWeight: 700,
    lineHeight: 1,
    color: '#000',
    textShadow: '0 1px 0 #fff',
    filter: 'alpha(opacity=20)',
    opacity: '.2',
  },
};

class FileUploadProgress extends React.Component {
  constructor(props) {
    super(props);
    this.proxy = new EventEmitter();
    this.state = {
      progress: -1,
      hasError: false,
      selectedFile:''
    };
  }

  cancelUpload() {
    this.proxy.emit('abort');
    this.setState({
      progress: -1,
      hasError: false,
    });
  }

  onSubmit(e) {
    e.preventDefault();
    this.setState({
      progress: 0,
      hasError: false,
    }, this._doUpload);
  }
  
  onFileSelection(e) {
    this.props.onFileSelection(e.target.value);
    this.setState({selectedFile:e.target.value, progress:-1}); 
  }
  
  render() {
    const formElement = this.props.formRenderer(this.onSubmit.bind(this), this.onFileSelection.bind(this));
    const progessElement = this.props.progressRenderer(
                            this.state.progress, this.state.hasError, this.cancelUpload.bind(this));

    return (
      <div>
        {formElement}
        {progessElement}
      </div>
    );
  }

  _getFormData() {
    if (this.props.formGetter) {
      return this.props.formGetter();
    }
    return new FormData(ReactDom.findDOMNode(this.refs.form));
  }
  _getBinaryData() {
    return this.refs.form.querySelector('input[type="file"]').files[0];
  }
  _doUpload() {
    
    this.setState({progress: -1});
    if(this.state.selectedFile == '')
        return;
        
    const req = new XMLHttpRequest();
    req.open('POST', this.props.url);
    
    var data = null;    
    if(this.props.binary){
        data = this._getBinaryData();
        req.setRequestHeader("Content-type", "application/octet-stream");
        req.setRequestHeader("Content-Disposition", "attachment; filename=\""+data.name+"\"");
    }else{
        var form = this._getFormData();
        data = this.props.formCustomizer(form);
    }
      
    if(this.props.headers){
      var headers = this.props.headers;
      for (var key in headers) {
        if (headers.hasOwnProperty(key)) {
          req.setRequestHeader(key, headers[key]);
        }
      }
    }
    
    req.addEventListener('load', (e) => {
      this.proxy.removeAllListeners(['abort']);
      const newState = { progress: 100 };
      if (req.status >= 200 && req.status <= 299) {
        newState.selectedFile = '';
        this.setState(newState, () => {
          e.filename = data.name;
          this.props.onLoad(e, req);
        });
      } else {
        newState.hasError = true;
        this.setState(newState, () => {
          this.props.onError(e, req);
        });
      }
    }, false);

    req.addEventListener('error', (e) => {
      this.setState({
        hasError: true,
      }, () => {
        this.props.onError(e, req);
      });
    }, false);

    req.upload.addEventListener('progress', (e) => {
      let progress = 0;
      if (e.total !== 0) {
        progress = parseInt((e.loaded / e.total) * 100, 10);
      }
      this.setState({
        progress,
      }, () => {
        this.props.onProgress(e, req, progress);
      });
    }, false);

    req.addEventListener('abort', (e) => {
      this.setState({
        progress: -1,
      }, () => {
        this.props.onAbort(e, req);
      });
    }, false);

    this.proxy.once('abort', () => {
      req.abort();
    });

    this.props.beforeSend(req)
              .send(this.props.formCustomizer(data));
  }
}

FileUploadProgress.propTypes = {
  url: React.PropTypes.string.isRequired,
  binary: React.PropTypes.boolean,
  disabled: React.PropTypes.boolean,
  headers: React.PropTypes.object,
  formGetter: React.PropTypes.func,
  formRenderer: React.PropTypes.func,
  progressRenderer: React.PropTypes.func,
  formCustomizer: React.PropTypes.func,
  beforeSend: React.PropTypes.func,
  onProgress: React.PropTypes.func,
  onLoad: React.PropTypes.func,
  onError: React.PropTypes.func,
  onAbort: React.PropTypes.func,
  onFileSelection: React.PropTypes.func
};

FileUploadProgress.defaultProps = {
  formRenderer: (onSubmit, onFileSelection) => (
      <form className="_react_fileupload_form_content" ref="form" method="post" onSubmit={onSubmit}>
        <div>
          <input type="file" value={this.state.selectedFile} name="file" onChange={onFileSelection} />
        </div>
        <input type="submit"  disabled={this.props.disabled} />
      </form>
    ),

  progressRenderer: (progress, hasError, cancelHandler) => {
    if (hasError || progress > -1) {
      const barStyle = objectAssign({}, styles.progressBar);
      barStyle.width = `${progress}%`;

      let message = (<span>Uploading ...</span>);
      if (hasError) {
        barStyle.backgroundColor = '#d9534f';
        message = (<span style={{ color: '#a94442' }}>Failed to upload ...</span>);
      }
      
      if (progress === 100 && !hasError) {
        message = (<span>Successfully uploaded</span>);
      }

      return (
        <div className="_react_fileupload_progress_content">
          <div style={styles.progressWrapper}>
            <div className="_react_fileupload_progress_bar" style={barStyle}></div>
          </div>
          <button
              className="_react_fileupload_progress_cancel"
              style={styles.cancelButton}
              onClick={cancelHandler}>
            <span>&times;</span>
          </button>
          <div style={{ clear: 'left' }}>
            {message}
          </div>
        </div>
      );
    }
    return '';
  },

  formCustomizer: (form) => form,
  beforeSend: (request) => request,
  onProgress: (e, request, progress) => {},
  onLoad: (e, request) => {},
  onError: (e, request) => {},
  onAbort: (e, request) => {},
  onFileSelection:(selectedFile) => {},
  binary:false,
  disabled:false
};

export default FileUploadProgress;
